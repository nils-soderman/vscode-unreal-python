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

    member_type = None
    if inspect.isgetsetdescriptor(member):
        member_type = EMemberType.PROPERTY
    elif inspect.ismethoddescriptor(member) or inspect.isbuiltin(member):
        member_type = EMemberType.METHOD

    return member_type, {
        "name": name,
        "doc": member.__doc__
    }


def generate(object_name: str, out_filepath: str):
    if not hasattr(unreal, object_name):
        print("No")
        return False

    ue_object = getattr(unreal, object_name)

    is_class = inspect.isclass(ue_object)

    bases_names = [x.__name__ for x in ue_object.__bases__]
    doc_string = ue_object.__doc__

    object_dict = ue_object.__dict__

    inherited_members = {EMemberType.METHOD: [], EMemberType.PROPERTY: []}
    unique_members = inherited_members.copy()

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
            inherited_members[member_type].append(member_data)

    data = {
        "doc": doc_string,
        "bases": bases_names,
        "members": {
            "inherited": inherited_members,
            "uniqe": unique_members
        }
    }

    with open(out_filepath, "w") as file:
        json.dump(data, file)

    return True


def main():
    object_name = globals().get("object")
    out_filepath = globals().get("outFilepath")

    return generate(object_name, out_filepath)


# generate("CheckBox", "")

print(main())
