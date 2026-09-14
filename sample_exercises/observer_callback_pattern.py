def notify_admin(event_name):
    print(f"Admin notified: {event_name} happened")

listeners = []
listeners.append(notify_admin)

def fire_event(event_name):
    for listener in listeners:
        listener(event_name)

def create_account(username):
    print(f"Creating account for {username}")
    fire_event(f"new account created for {username}")

create_account("alice")