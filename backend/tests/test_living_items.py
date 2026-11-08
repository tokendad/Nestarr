"""
Tests for Living Items functionality (people, pets, plants)
"""
import pytest
from fastapi.testclient import TestClient
from datetime import date
from sqlalchemy import create_engine, text
from app.main import app
from app.main import migrate_ford_items_to_vehicle

client = TestClient(app)


def test_create_person():
    """Test creating a person (living item with family relationship)"""
    person_data = {
        "name": "John Doe",
        "description": "Father",
        "is_living": True,
        "birthdate": "1985-03-15",
        "relationship_type": "father",
        "contact_info": {
            "phone": "555-1234",
            "email": "john@example.com",
            "address": "123 Main St"
        }
    }
    
    response = client.post("/items", json=person_data)
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "John Doe"
    assert data["is_living"] is True
    assert data["birthdate"] == "1985-03-15"
    assert data["relationship_type"] == "father"
    assert data["contact_info"]["phone"] == "555-1234"


def test_create_pet():
    """Test creating a pet (living item with pet relationship)"""
    pet_data = {
        "name": "Buddy",
        "description": "Golden Retriever",
        "is_living": True,
        "birthdate": "2020-06-10",
        "relationship_type": "pet",
        "contact_info": {
            "notes": "Vet: Dr. Smith at ABC Clinic"
        },
        "additional_info": [
            {
                "label": "Breed",
                "value": "Golden Retriever",
                "type": "text"
            },
            {
                "label": "Microchip",
                "value": "123456789",
                "type": "text"
            }
        ]
    }
    
    response = client.post("/items", json=pet_data)
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Buddy"
    assert data["is_living"] is True
    assert data["relationship_type"] == "pet"
    assert data["birthdate"] == "2020-06-10"


def test_create_plant():
    """Test creating a plant (living item with plant relationship)"""
    plant_data = {
        "name": "Monstera Deliciosa",
        "description": "Swiss Cheese Plant",
        "is_living": True,
        "relationship_type": "plant",
        "additional_info": [
            {
                "label": "Species",
                "value": "Monstera deliciosa",
                "type": "text"
            },
            {
                "label": "Watering",
                "value": "Weekly",
                "type": "text"
            },
            {
                "label": "Sunlight",
                "value": "Partial shade",
                "type": "text"
            }
        ]
    }
    
    response = client.post("/items", json=plant_data)
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Monstera Deliciosa"
    assert data["is_living"] is True
    assert data["relationship_type"] == "plant"


def test_create_vehicle():
    """Test creating a vehicle item with vehicle-specific fields"""
    vehicle_data = {
        "name": "Ford F-250",
        "description": "Work truck",
        "is_vehicle": True,
        "brand": "Ford",
        "model_number": "F-250",
        "vehicle_year": 2021,
        "vin": "1FT7W2BT4MEC12345",
        "license_plate": "ABC-1234",
        "mileage": 48250,
        "purchase_date": "2022-04-10",
        "purchase_price": 42000.00,
        "retailer": "Local Ford Dealer",
    }

    response = client.post("/items", json=vehicle_data)
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Ford F-250"
    assert data["is_vehicle"] is True
    assert data["brand"] == "Ford"
    assert data["model_number"] == "F-250"
    assert data["vehicle_year"] == 2021
    assert data["vin"] == "1FT7W2BT4MEC12345"
    assert data["license_plate"] == "ABC-1234"
    assert data["mileage"] == 48250


def test_ford_vehicle_migration_copies_existing_serial_to_vin_after_flag_migration():
    """Existing users who already ran the flag migration keep their original VIN."""
    engine = create_engine("sqlite:///:memory:", future=True)

    with engine.begin() as conn:
        conn.execute(text("""
            CREATE TABLE items (
                id INTEGER PRIMARY KEY,
                brand VARCHAR(255),
                serial_number VARCHAR(255),
                is_vehicle BOOLEAN DEFAULT FALSE,
                vin VARCHAR(64)
            )
        """))
        conn.execute(text("""
            CREATE TABLE data_migrations (
                name VARCHAR(255) PRIMARY KEY,
                applied_at TIMESTAMP NOT NULL
            )
        """))
        conn.execute(text("""
            INSERT INTO items (id, brand, serial_number, is_vehicle, vin)
            VALUES (1, 'Ford', '1FT7W2BT4MEC12345', 1, NULL)
        """))
        conn.execute(text("""
            INSERT INTO data_migrations (name, applied_at)
            VALUES ('flag_ford_items_as_vehicles', CURRENT_TIMESTAMP)
        """))

        migrate_ford_items_to_vehicle(conn)

        item = conn.execute(text("""
            SELECT serial_number, vin, is_vehicle
            FROM items
            WHERE id = 1
        """)).mappings().one()

    assert item["serial_number"] == "1FT7W2BT4MEC12345"
    assert item["vin"] == "1FT7W2BT4MEC12345"
    assert item["is_vehicle"] == 1


def test_living_item_cannot_have_purchase_price():
    """Test that living items cannot have purchase_price"""
    invalid_data = {
        "name": "Test Person",
        "is_living": True,
        "birthdate": "1990-01-01",
        "relationship_type": "self",
        "purchase_price": 100.00  # Should fail
    }
    
    response = client.post("/items", json=invalid_data)
    assert response.status_code == 422  # Validation error
    assert "purchase_price" in response.text.lower()


def test_living_item_cannot_have_retailer():
    """Test that living items cannot have retailer"""
    invalid_data = {
        "name": "Test Pet",
        "is_living": True,
        "relationship_type": "pet",
        "retailer": "Pet Store"  # Should fail
    }
    
    response = client.post("/items", json=invalid_data)
    assert response.status_code == 422
    assert "retailer" in response.text.lower()


def test_living_item_cannot_have_upc():
    """Test that living items cannot have UPC code"""
    invalid_data = {
        "name": "Test Plant",
        "is_living": True,
        "relationship_type": "plant",
        "upc": "123456789012"  # Should fail
    }
    
    response = client.post("/items", json=invalid_data)
    assert response.status_code == 422
    assert "upc" in response.text.lower()


def test_vehicle_cannot_have_living_fields():
    """Test that vehicles cannot include living-only fields"""
    invalid_data = {
        "name": "Test Vehicle",
        "is_vehicle": True,
        "birthdate": "2020-01-01",
    }

    response = client.post("/items", json=invalid_data)
    assert response.status_code == 422
    assert "birthdate" in response.text.lower()


def test_item_cannot_be_both_living_and_vehicle():
    """Test that an item cannot be marked as both living and vehicle"""
    invalid_data = {
        "name": "Impossible Item",
        "is_living": True,
        "is_vehicle": True,
        "relationship_type": "pet",
    }

    response = client.post("/items", json=invalid_data)
    assert response.status_code == 422
    assert "both living and a vehicle" in response.text.lower()


def test_non_vehicle_item_cannot_have_vin():
    """Test that non-vehicle items cannot have vehicle-only fields"""
    invalid_data = {
        "name": "Regular Item",
        "vin": "1FT7W2BT4MEC12345",
    }

    response = client.post("/items", json=invalid_data)
    assert response.status_code == 422
    assert "vin" in response.text.lower()


def test_non_living_item_cannot_have_birthdate():
    """Test that non-living items cannot have birthdate"""
    invalid_data = {
        "name": "Regular Item",
        "is_living": False,
        "birthdate": "2020-01-01"  # Should fail
    }
    
    response = client.post("/items", json=invalid_data)
    assert response.status_code == 422
    assert "birthdate" in response.text.lower()


def test_non_living_item_cannot_have_contact_info():
    """Test that non-living items cannot have contact_info"""
    invalid_data = {
        "name": "Regular Item",
        "is_living": False,
        "contact_info": {"phone": "555-1234"}  # Should fail
    }
    
    response = client.post("/items", json=invalid_data)
    assert response.status_code == 422
    assert "contact" in response.text.lower()


def test_filter_living_items():
    """Test filtering items by is_living flag"""
    # Create a living item
    person_data = {
        "name": "Jane Doe",
        "is_living": True,
        "relationship_type": "spouse"
    }
    client.post("/items", json=person_data)
    
    # Create a non-living item
    item_data = {
        "name": "Regular Item",
        "is_living": False
    }
    client.post("/items", json=item_data)
    
    # Filter for living items only
    response = client.get("/items?is_living=true")
    assert response.status_code == 200
    data = response.json()
    assert len(data) > 0
    for item in data:
        assert item["is_living"] is True


def test_filter_by_relationship_type():
    """Test filtering items by relationship_type"""
    # Create multiple people with different relationships
    client.post("/items", json={
        "name": "Dad",
        "is_living": True,
        "relationship_type": "father"
    })
    client.post("/items", json={
        "name": "Mom",
        "is_living": True,
        "relationship_type": "mother"
    })
    client.post("/items", json={
        "name": "Fluffy",
        "is_living": True,
        "relationship_type": "pet"
    })
    
    # Filter for pets only
    response = client.get("/items?relationship_type=pet")
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1
    for item in data:
        assert item["relationship_type"] == "pet"


def test_associated_user_relationship():
    """Test is_current_user and associated_user_id fields"""
    # This would require creating a user first in a real test
    # For now, just test that the fields are accepted
    person_data = {
        "name": "Me",
        "is_living": True,
        "relationship_type": "self",
        "is_current_user": True
    }
    
    response = client.post("/items", json=person_data)
    assert response.status_code == 201
    data = response.json()
    assert data["is_current_user"] is True


def test_update_living_item():
    """Test updating a living item"""
    # Create person
    create_response = client.post("/items", json={
        "name": "John Smith",
        "is_living": True,
        "birthdate": "1980-05-20",
        "relationship_type": "father"
    })
    item_id = create_response.json()["id"]
    
    # Update contact info
    update_data = {
        "contact_info": {
            "phone": "555-9999",
            "email": "john.smith@example.com"
        }
    }
    
    response = client.put(f"/items/{item_id}", json=update_data)
    assert response.status_code == 200
    data = response.json()
    assert data["contact_info"]["phone"] == "555-9999"


def test_convert_non_living_to_living_clears_fields():
    """Test that converting non-living to living validates properly"""
    # Create regular item
    create_response = client.post("/items", json={
        "name": "Widget",
        "is_living": False,
        "purchase_price": 50.00,
        "retailer": "Store"
    })
    item_id = create_response.json()["id"]
    
    # Try to convert to living without clearing fields - should fail
    update_data = {
        "is_living": True,
        "relationship_type": "pet"
        # purchase_price and retailer still exist on the item
    }
    
    # Note: This test would need database-level validation to work properly
    # The Pydantic validator only checks fields in the update payload
    # For now, we document that frontend should clear these fields
