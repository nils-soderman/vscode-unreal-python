import inspect
import unreal
import types
import time
import json


class EMemberType:
    PROPERTY = "property"
    METHOD = "method"


def get_member_data(memeber_name: str, member: object):
    name = memeber_name
    if inspect.ismethod(member) or inspect.isfunction(member):
        name += ()

    doc = member.__doc__

    member_type = None
    if inspect.isgetsetdescriptor(member) or inspect.ismemberdescriptor(member):
        member_type = EMemberType.PROPERTY
    elif inspect.ismethoddescriptor(member) or inspect.isbuiltin(member):
        member_type = EMemberType.METHOD
    elif issubclass(type(member), unreal.EnumBase):        
        member_type = EMemberType.PROPERTY
        doc = str(member.value)
        
    return member_type, {
        "name": name,
        "doc": doc
    }


def generate(object_name: str):
    if not hasattr(unreal, object_name):
        return

    ue_object = getattr(unreal, object_name)

    is_class = inspect.isclass(ue_object)

    bases_names = [x.__name__ for x in ue_object.__bases__]
    doc_string = ue_object.__doc__

    object_dict = ue_object.__dict__

    inherited_members = {EMemberType.METHOD: [], EMemberType.PROPERTY: []}
    unique_members = {EMemberType.METHOD: [], EMemberType.PROPERTY: []}

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


# print(generate("ClampMode"))

print(main())
