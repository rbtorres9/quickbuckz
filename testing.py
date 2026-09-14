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

me = User("whoami", "idontknow@example.com", "imyou")
you = User("youarenot", "maybeiknow@example.com", "youareme")

print(me, you)