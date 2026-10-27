import os

# Set before the API lifespan can run. Importing the app does not boot Hindsight;
# this keeps TestClient from doing so, and blocks dotenv from turning the gate back on.
os.environ["CODEDNA_HINDSIGHT_AUTOSTART"] = "0"
os.environ["CODEDNA_DEMO_SCENE"] = ""
