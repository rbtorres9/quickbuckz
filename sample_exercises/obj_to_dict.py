import json

class Book:
    def __init__(self, title, author, pages):
        self.title = title
        self.author = author
        self.pages = pages

book = Book("Dune", "Frank Herbert", 412)

# Write a function book_to_dict(book) that returns a dictionary with keys "title", "author", "pages", pulling values off the book object.
# Call it on book and print the result.
# Bonus: import Python's built-in json module and use json.dumps(...) on your dictionary to see what it looks like as an actual JSON string.

def book_to_dict(book):
    return { 'title': book.title, 'author': book.author, 'pages': book.pages ,}

print(book_to_dict(book))

print(json.dumps(book_to_dict(book)))