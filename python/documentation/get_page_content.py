import inspect
import unreal
import types
import copy
import json


class EMemberType:
    PROPERTY = "property"
    METHOD = "method"
    DECORATOR = "decorator"


DEFAULT_DICT_LAYOUT = {
    EMemberType.METHOD: [],
    EMemberType.PROPERTY: [],
    EMemberType.DECORATOR: []
}


def get_member_data(memeber_name: str, member: object):
    name = memeber_name
    # if inspect.ismethod(member) or inspect.isfunction(member):
    #     name += "()"

    doc = member.__doc__

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
        return

    ue_object = getattr(unreal, object_name)

    is_class = inspect.isclass(ue_object)

    if (is_class):
        bases_names = [x.__name__ for x in ue_object.__bases__]

        object_dict = ue_object.__dict__
        doc_string = ue_object.__doc__

        inherited_members = copy.deepcopy(DEFAULT_DICT_LAYOUT)
        unique_members = copy.deepcopy(DEFAULT_DICT_LAYOUT)

        for memeber_name, member in inspect.getmembers(ue_object):
            if memeber_name.startswith("_"):
                continue

            member_type, member_data = get_member_data(memeber_name, member)

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
        doc_string = unreal.__doc__
        bases_names = None
        inherited_members = copy.deepcopy(DEFAULT_DICT_LAYOUT)
        unique_members = copy.deepcopy(DEFAULT_DICT_LAYOUT)
        for function_name, function in inspect.getmembers(unreal):
            if not isinstance(function, (types.BuiltinFunctionType, types.FunctionType)):
                continue

            member_type, member_data = get_member_data(function_name, function)
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
        with open(out_filepath, "w") as file:
            json.dump(data, file)

        return True
    return False


# generate("is_editor")

print(main())
