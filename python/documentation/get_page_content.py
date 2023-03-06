""" Generates a JSON file with an indepth documentation for a given object """

import inspect
import types
import copy
import json

import unreal


class EMemberType:
    PROPERTY = "Properties"
    METHOD = "Methods"
    DECORATOR = "Decorators"


DEFAULT_DICT_LAYOUT = {
    EMemberType.PROPERTY: [],
    EMemberType.METHOD: [],
    EMemberType.DECORATOR: []
}


def get_docstring(obj: object, object_name: str):
    doc_string = obj.__doc__

    is_class = inspect.isclass(obj)

    # In docstrings, underscores are replaced with spaces
    name_comparison = object_name.replace("_", " ")

    if "\n" in doc_string:
        lines = []
        for index, line in enumerate(doc_string.split("\n")):
            line = line.rstrip()

            # Break before it list's all each class member
            if is_class and line.startswith("**Editor Properties"):
                break

            if index == 0:
                if line == name_comparison or line[1:] == name_comparison:
                    continue

            if line.startswith("    "):
                line = f"- {line.strip().rstrip(':')}"

            lines.append(line)

        doc_string = "\n".join(lines)

    return doc_string


def get_member_data(member: object, memeber_name: str):
    name = memeber_name
    # if inspect.ismethod(member) or inspect.isfunction(member):
    #     name += "()"

    doc = get_docstring(member, memeber_name)

    member_type = None
    if inspect.isgetsetdescriptor(member) or inspect.ismemberdescriptor(member):
        member_type = EMemberType.PROPERTY
    elif inspect.ismethoddescriptor(member) or inspect.isbuiltin(member):
        member_type = EMemberType.METHOD

    elif issubclass(type(member), unreal.EnumBase):
        member_type = EMemberType.PROPERTY
        doc = str(member.value)
    elif inspect.isfunction(member):
        member_type = EMemberType.DECORATOR
        name += "()"

    return member_type, {
        "name": name,
        "doc": doc
    }


def generate(object_name: str):
    if not hasattr(unreal, object_name):
        return None

    ue_object = getattr(unreal, object_name)

    is_class = inspect.isclass(ue_object)

    if is_class:
        bases_names = [x.__name__ for x in ue_object.__bases__]

        object_dict = ue_object.__dict__
        doc_string = get_docstring(ue_object, object_name)

        inherited_members = copy.deepcopy(DEFAULT_DICT_LAYOUT)
        unique_members = copy.deepcopy(DEFAULT_DICT_LAYOUT)

        for memeber_name, member in inspect.getmembers(ue_object):
            if memeber_name.startswith("_"):
                continue

            member_type, member_data = get_member_data(member, memeber_name)

            # Check where the method/property originates from
            #  Inherited                          Overriden
            if memeber_name not in object_dict or any(hasattr(x, memeber_name) for x in ue_object.__bases__):
                # Inherited
                inherited_members[member_type].append(member_data)
            else:
                # Unique
                unique_members[member_type].append(member_data)
    else:
        object_name = "Unreal Functions"
        doc_string = get_docstring(unreal, object_name)
        bases_names = None
        inherited_members = copy.deepcopy(DEFAULT_DICT_LAYOUT)
        unique_members = copy.deepcopy(DEFAULT_DICT_LAYOUT)
        for function_name, function in inspect.getmembers(unreal):
            if not isinstance(function, (types.BuiltinFunctionType, types.FunctionType)):
                continue

            member_type, member_data = get_member_data(function, function_name)
            unique_members[member_type].append(member_data)

    return {
        "name": object_name,
        "doc": doc_string,
        "bases": bases_names,
        "members": {
            "inherited": inherited_members,
            "unique": unique_members
        }
    }


def main():
    object_name = globals().get("object")
    out_filepath = globals().get("outFilepath")

    data = generate(object_name)
    if data:
        with open(out_filepath, "w", encoding="utf-8") as file:
            json.dump(data, file)

        return True
    return False


# generate("Object")

print(main())
