from enum import Enum


class RoleEnum(str,Enum):
    user="user"
    admin = "admin"
    superuser= "superuser"


class RoleEnum2(str,Enum):
    user="user"
    admin = "admin"


class ThemeEnum(str,Enum):
    light = "light"
    dark = "dark"


