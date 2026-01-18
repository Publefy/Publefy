
def convert_objectId_to_str(collection, is_need_del=False):
    for document in collection:
        document["_id"] = str(document["_id"])
        if is_need_del:
            del document["_id"]

    return collection