# Inheritance Refresher

class Animal:
    def __init__(self, name):
        self.name = name

    def speak(self):
        return f"{self.name} makes a sound"

class Dog(Animal):
    def speak(self):
        return f"{self.name} barks"
		

# Create a class Cat that inherits from Animal but overrides speak() to return "{name} meows".
# Create a class ServiceDog that inherits from Dog and adds a new attribute handler in its __init__, while still setting name via Dog's behavior. (Hint: you'll need to call super().__init__(...).)

class Cat(Animal):
  def speak(self):
    return f"{self.name} meows"

class ServiceDog(Dog):
  def __init__(self, name, handler):
    super().__init__(name)
    self.handler = handler