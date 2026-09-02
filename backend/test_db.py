import pyodbc
import os
from dotenv import load_dotenv

load_dotenv()
server = os.getenv("SERVER")
database = os.getenv("DATABASE")

connection_string = (
    "Driver={ODBC Driver 18 for SQL Server};"
    f"Server={server};"
    f"Database={database};"
    "Authentication=ActiveDirectoryInteractive;"
    "Encrypt=yes;"
    "TrustServerCertificate=no;"
)

conn = pyodbc.connect(connection_string)

print("Connected successfully!")

cursor = conn.cursor()

cursor.execute("""
   SELECT TOP 10*
   From dbo.DimBuilding

""")
rows = cursor.fetchall()

print("\nAvailable databases: ")

for row in rows:
    print(row)

cursor.close()
conn.close()