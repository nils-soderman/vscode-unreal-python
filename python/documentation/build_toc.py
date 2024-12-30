"""
Print a JSON object with the table of contents for the Unreal Engine Python API.

This script inspects the Unreal Engine Python API and generates a JSON object
containing the table of contents, including classes, methods, properties, etc.
"""
from __future__ import annotations

import inspect
import types
import json

import unreal


def issubclass_strict(__cls: type, __class_or_tuple):
    if not issubclass(__cls, __class_or_tuple):
        return False

    if isinstance(__class_or_tuple, tuple):
        return __cls not in __class_or_tuple

    return __cls is not __class_or_tuple


class UnrealClassRepresentation():
    """ 
    Each class in the unreal API will be represented by an instance of this class. (e.g. Enums, Structs, Classes)
    This class contains all methods, properties, constants, etc. of the class it represents.
    """
    def __init__(self, name: str, cls):
        self.name = name
        self.cls = cls

        self.methods: list[tuple[str, types.MethodDescriptorType]] = []
        self.classmethods: list[tuple[str, types.BuiltinFunctionType]] = []
        self.properties: list[tuple[str, unreal.EnumBase | unreal.StructBase]] = []
        self.constants: list[tuple[str, int]] = []

        self.load_members()

    def load_members(self):
        for name, member in inspect.getmembers(self.cls):
            # ignore private methods / properties
            if name.startswith("_"):
                continue

            # ignore inherited methods / properties
            if name not in self.cls.__dict__:
                continue

            if inspect.ismethoddescriptor(member):
                self.methods.append((name, member))
            elif inspect.isgetsetdescriptor(member):
                self.properties.append((name, member))
            elif issubclass(type(member), unreal.EnumBase):
                self.properties.append((name, member))
            elif issubclass(type(member), unreal.StructBase):
                self.properties.append((name, member))
            elif inspect.isbuiltin(member):
                self.classmethods.append((name, member))
            elif inspect.ismemberdescriptor(member):
                # TODO: this might be incorrect
                self.properties.append((name, member))
            elif isinstance(member, int):
                self.constants.append((name, member))
            # else:
            #     print(f"{name}: {member} -> {type(member)}")

    def get_dict(self):
        data = {}

        for object_type, object_list, in (("func", self.methods),
                                        ("cls_func", self.classmethods),
                                        ("prop", self.properties),
                                        ("const", self.constants)
                                        ):
            if object_list:
                data[object_type] = [name for name, member in object_list]

        return data


class TableOfContents():
    """ Main class used for generating the table of contents. """
    def __init__(self):
        self.classes: list[UnrealClassRepresentation] = []
        self.enums: list[UnrealClassRepresentation] = []
        self.struct: list[UnrealClassRepresentation] = []
        self.delegates: list[UnrealClassRepresentation] = []
        self.natives: list[UnrealClassRepresentation] = []
        self.functions: list[tuple[str, types.BuiltinFunctionType | types.FunctionType]] = []

    def load(self):
        """
        Load all classes, enums, structs, delegates, functions, etc. from the unreal module.
        """
        for object_name, obj in inspect.getmembers(unreal):
            if inspect.isclass(obj):
                classobject = UnrealClassRepresentation(object_name, obj)

                if issubclass_strict(obj, unreal.EnumBase):
                    self.enums.append(classobject)
                elif issubclass_strict(obj, unreal.StructBase):
                    self.struct.append(classobject)
                elif issubclass_strict(obj, (unreal.DelegateBase, unreal.MulticastDelegateBase)):
                    self.delegates.append(classobject)
                elif issubclass_strict(obj, unreal.Object):
                    self.classes.append(classobject)
                else:
                    self.natives.append(classobject)

            elif inspect.isfunction(obj) or isinstance(obj, types.BuiltinFunctionType):
                self.functions.append((object_name, obj))

            # else:
            #     print(f"Skip adding {object_name}: {obj} to the toc.")

    def get_dict(self):
        """ Generate a dictionary containing the table of contents """
        data = {}
        for name, object_list, in (("Native", self.natives),
                                   ("Struct", self.struct),
                                   ("Class", self.classes),
                                   ("Enum", self.enums),
                                   ("Delegate", self.delegates),
                                   ):

            data[name] = {x.name: x.get_dict() for x in object_list}

        data["Function"] = {name: {} for name, function in self.functions}

        return data


def get_table_of_content_json():
    table_of_contents = TableOfContents()
    table_of_contents.load()

    # Use separators withouth spaces to reduce the size of the JSON object
    return json.dumps(table_of_contents.get_dict(), separators=(',', ':'))
