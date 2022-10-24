import inspect

import unreal
import types
import time
import json


def issubclass_strict(__cls: type, __class_or_tuple):
    if not issubclass(__cls, __class_or_tuple):
        return False

    if isinstance(__class_or_tuple, tuple):
        return __cls not in __class_or_tuple

    return __cls is not __class_or_tuple


class TableOfContentsClass():
    def __init__(self, name: str, cls):
        self.name = name
        self.cls = cls

        self.methods = []
        self.classmethods = []
        self.properties = []
        self.constants = []

        self.load_memebers()

    def load_memebers(self):
        for name, member in inspect.getmembers(self.cls):
            # ignore private methods / properties
            if name.startswith("_"):
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
            else:
                print(f"{name}: {member} -> {type(member)}")

    def get_dict(self):
        data = {}

        for name, object_list, in (("Method", self.methods),
                                   ("Class Method", self.classmethods),
                                   ("Property", self.properties),
                                   ("Constant", self.constants)
                                   ):
            data[name] = [name for name, cls in object_list]

        return data


class UnrealTableOfContents():
    def __init__(self):
        self.classes = []
        self.enums = []
        self.struct = []
        self.delegates = []
        self.functions = []
        self.natives = []

    def load(self):
        for object_name, obj in inspect.getmembers(unreal):
            if inspect.isclass(obj):
                classobject = TableOfContentsClass(object_name, obj)
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

            else:
                print(f"Skip adding {object_name}: {obj} to the toc.")

    def get_dict(self):
        example = {
            "struct": {},
            "enum": {},
            "delegate": {},
            "class": {},
            "native": {}
        }

        data = {}
        for name, object_list, in (("Native", self.natives),
                                   ("Struct", self.struct),
                                   ("Class", self.classes),
                                   ("Enum", self.enums),
                                   ("Delegate", self.delegates),
                                   ):

            data[name] = {x.name: x.get_dict() for x in object_list}

        # Functions are just a flat list
        data["Function"] = [name for name, cls in self.functions]

        return data


def main():
    # We set the outFilepath in VS Code
    filepath = globals().get("outFilepath")
    if not filepath:
        return False

    start_time = time.perf_counter()
    table_of_contents = UnrealTableOfContents()
    table_of_contents.load()

    with open(filepath, "w") as file:
        json.dump(table_of_contents.get_dict(), file)

    print(f"Took {time.perf_counter() - start_time:.2}s")

    return True


print(main())