

def handlerequest(request_data):
    # pretend request_data is liek {"action": "get_profile"}
    if request_data["action"] == "get_profile":
        return { "status": 200, "body": { "username": "alice" , "bio": "hi"} }
    else:
        return { "status": 404, "body": { "error": "not found"} }


a = handlerequest( { "action": "get_profile" } )
b = handlerequest( { "action": "delete_profile" } )

print((a, b))