import time
from openai import OpenAI
from credits import SECRET_KEY, ASSISTANT_ID
client = OpenAI(api_key=SECRET_KEY)

def create_new_thread(content):
    return client.beta.threads.create(messages=[{"role": "user", "content": content}])

def add_message_to_thread(thread_id, content):
    return client.beta.threads.messages.create(thread_id=thread_id, role="user", content=content)

def run_thread(thread_id, assistant_id=None):
    run = client.beta.threads.runs.create(thread_id=thread_id, assistant_id=assistant_id or ASSISTANT_ID)
    while run.status != 'completed':
        run = client.beta.threads.runs.retrieve(thread_id=thread_id, run_id=run.id)
        time.sleep(1)
    return run

def get_thread_messages(thread_id):
    return client.beta.threads.messages.list(thread_id=thread_id).data

def format_conversation(messages):
    return [{"role": msg.role, "content": getattr(msg.content[0].text, 'value', str(msg.content))} for msg in messages]
