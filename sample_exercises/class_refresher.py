class Book:
    def __init__(self, title, author, pages):
        self.title = title
        self.author = author
        self.pages = pages

    def __str__(self):
        return f"{self.title} by {self.author}"



class User:
    def __init__(self, username, email, bio):
        self.username = username
        self.email = email
        self.bio = bio

    def __str__(self):
        return f"{self.username}"

# Your turn:
# 1. Create a class `User` with attributes: username, email, bio
# 2. Give it a __str__ method that returns just the username
# 3. Create two User instances and print them

me = User("whoami", "idontknow@example.com", "imyou")
you = User("youarenot", "maybeiknow@example.com", "youareme")

print(me, you)