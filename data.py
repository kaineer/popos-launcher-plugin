from dataclasses import dataclass

@dataclass
class Selection:
    id: int
    name: str
    description: str

    def __init__(self, id, name, description = ''):
        self.id = id
        self.name = name
        self.description = description

    def to_json(self):
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description
        }
