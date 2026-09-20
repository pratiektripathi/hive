from passlib.context import CryptContext



pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")



def get_hash_pass(password):
    return pwd_context.hash(password)
    

def verify_pass(password,hash_password):
    return pwd_context.verify(password,hash_password)







