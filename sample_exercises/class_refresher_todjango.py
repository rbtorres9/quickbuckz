# Connecting it to Django

from django.db import models

class User(models.Model):
    username = models.CharField(max_length=150)
    email = models.EmailField()
    bio = models.TextField(blank=True)

    def __str__(self):
        return self.username
        
        

# It inherits from models.Model instead of nothing
# Each attribute becomes a Field object instead of a plain value — that's what tells Django what column type to create in PostgreSQL (CharField → varchar, # TextField → text, etc.)
# You don't write __init__ — Django generates it for you based on the fields
# __str__ works exactly the same

