# Imagine a folder structure like this:
# myproject/
#   utils/
#     __init__.py
#     math_helpers.py
#
# math_helpers.py contains:
def add(a, b):
    return a + b

def multiply(a, b):
    return a * b
	
	
# If you're in a script outside utils/, what line of code would import add from math_helpers.py?
# What's the purpose of the empty __init__.py file — why does Python need it there?

# To import the function directly so you can just call add(2, 3), you'd write:

# python
# from utils.math_helpers import add

# (dot notation to go folder → file → function)

# __init__.py has nothing to do with Django or Models specifically. It's a plain Python concept: an empty __init__.py file is what tells Python "treat this folder as a package," so you're allowed to import from it. Without it (in older Python) imports like from utils import math_helpers would fail. Django apps use this same mechanism — every Django app is just a Python package, which is why it always has an __init__.py in it.