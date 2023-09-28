""" Generates a JSON file with an indepth documentation for a given object """

import inspect
import types
import copy
import json
import re

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

# Regex pattern that matches "(X): [X] X:", used for property docstrings
PROPERTY_DOCSTRING_PATTERN = re.compile(r"\(*.+\):  \[[^\]]+\] [^\)]+[\:]?")

# Regex pattern that matches "abc.X(X) -> X ", where X is any character, used for function docstrings
FUNCTION_DOCSTRING_PATTERN = re.compile(r"^[Xx].+\(*\)\s*->\s*[\w\,]*\s*(or None)?")


def get_docstring(obj: object, object_name: str):
    is_class = inspect.isclass(obj)

    def _patch_line(line: str, index: int):
        line = line.rstrip()

        # Special cases for the first line
        if index == 0:

            # For classes, if docstring starts with just the class name, remove it
            if is_class:
                name_comparison = object_name.replace("_", "").lower()
                line_comparison = line.replace(" ", "").lower()
                if line_comparison == name_comparison or line_comparison[1:] == name_comparison:
                    return ""

            else:  # TODO: Spesifically check function/property
                matches = PROPERTY_DOCSTRING_PATTERN.findall(line)
                if matches:
                    matching_text: str = matches[0]
                    var_type, _, permission = matching_text.partition(":")
                    permission = permission.rpartition("]")[0].strip("[ ")
                    end_sign = ":" if matching_text.endswith(":") else ""
                    line = f"{var_type} [_{permission}_]{end_sign} {line.replace(matching_text, '')}"

        # Add a new line before the C++ Source
        if is_class and "**C++ Source:" in line:
            line = line.replace("**C++ Source:", "\n**C++ Source:")

        if line.startswith("    "):
            line = f"- {line.strip().rstrip(':')}"

        return line

    doc_string = obj.__doc__

    if doc_string and "\n" in doc_string:
        lines = []
        for index, line in enumerate(doc_string.split("\n")):
            line = _patch_line(line, index)
            if not line:
                continue

            # Break before it list's all each class member
            if is_class and line.startswith("**Editor Properties"):
                break

            lines.append(line)

        doc_string = "\n".join(lines)

    elif doc_string:
        doc_string = _patch_line(doc_string, 0).strip()

    return doc_string


def patch_method_name_and_doc(name: str, doc: str):
    name_hints = ""

    if "--" in doc:
        name, _, doc = doc.partition("--")
        if "(" in name:
            name, delimiter, name_hints = name.partition("(")
            name_hints = delimiter + name_hints  # re-append the delimiter
    else:
        match = FUNCTION_DOCSTRING_PATTERN.match(doc)
        if match:
            matching_text: str = doc[match.start():match.end()]
            _, delimiter, name_hints = matching_text.partition("(")
            name_hints = delimiter + name_hints
            doc = doc[match.end():]

    return name, name_hints, doc


def get_member_data(member: object, memeber_name: str):
    name = memeber_name

    doc = get_docstring(member, memeber_name)

    member_type = None
    name_hints = ""
    if inspect.isgetsetdescriptor(member) or inspect.ismemberdescriptor(member):
        member_type = EMemberType.PROPERTY
    elif inspect.ismethoddescriptor(member) or inspect.isbuiltin(member):
        member_type = EMemberType.METHOD
        name, name_hints, doc = patch_method_name_and_doc(name, doc)
    elif issubclass(type(member), unreal.EnumBase):
        member_type = EMemberType.PROPERTY
        doc = str(member.value)
    elif inspect.isfunction(member):
        member_type = EMemberType.DECORATOR
        name += "()"

    return member_type, {
        "name": name.strip(),
        "doc": doc.strip(),
        "name_hints": name_hints.strip()
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
        bases_names = []
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
        },
        "is_class": is_class
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


unreal.log(main())
