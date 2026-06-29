from app import app

with app.test_client() as client:
    response = client.get('/')
    with open('index.html', 'wb') as f:
        f.write(response.data)
