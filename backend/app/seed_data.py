"""
Database seeding script for Nestarr.
Pre-populates the database with test users, locations, and items.
"""
import uuid
from datetime import datetime, date, timedelta
from decimal import Decimal
from sqlalchemy.orm import Session

from . import models
from .auth import get_password_hash


def seed_database(db: Session) -> None:
    """
    Seeds the database with test data if it's empty.
    Only runs if there are no existing users to avoid duplicate data.
    """
    # Check if database already has data
    existing_users = db.query(models.User).count()
    if existing_users > 0:
        print("Database already contains data. Skipping seed.")
        return

    print("Seeding database with test data...")

    # Create predefined tags first
    tags = create_tags(db)
    print(f"Created {len(tags)} tags")

    # Create test users
    users = create_users(db)
    print(f"Created {len(users)} users")

    # Create test locations
    locations = create_locations(db)
    print(f"Created {len(locations)} locations")

    # Create test items
    items = create_items(db, locations, tags)
    print(f"Created {len(items)} items")

    # Create maintenance tasks for some items
    tasks = create_maintenance_tasks(db, items)
    print(f"Created {len(tasks)} maintenance tasks")

    db.commit()
    print("Database seeding completed successfully!")


def create_tags(db: Session) -> dict:
    """Create predefined tags for categorizing items."""
    predefined_tags = [
        "Electronics",
        "Computers",
        "Appliances",
        "Tools",
        "Vehicles",
        "Furniture",
        "Sports Equipment",
        "Home & Garden",
        "Kitchen",
        "Office Supplies",
        "Living",  # For people, pets, plants, and other living things
    ]
    
    tags = {}
    for tag_name in predefined_tags:
        tag = models.Tag(
            id=uuid.uuid4(),
            name=tag_name,
            is_predefined=True,
        )
        db.add(tag)
        tags[tag_name] = tag
    
    db.flush()
    return tags


def create_users(db: Session) -> list:
    """Create test users with different roles."""
    users = [
        models.User(
            id=uuid.uuid4(),
            email="admin@nestarr.local",
            password_hash=get_password_hash("admin123"),
            full_name="Admin User",
            role=models.UserRole.ADMIN,
            is_approved=True,  # Seeded users are approved by default
        ),
        models.User(
            id=uuid.uuid4(),
            email="editor@nestarr.local",
            password_hash=get_password_hash("editor123"),
            full_name="Editor User",
            role=models.UserRole.EDITOR,
            is_approved=True,  # Seeded users are approved by default
        ),
        models.User(
            id=uuid.uuid4(),
            email="viewer@nestarr.local",
            password_hash=get_password_hash("viewer123"),
            full_name="Viewer User",
            role=models.UserRole.VIEWER,
            is_approved=True,  # Seeded users are approved by default
        ),
    ]

    for user in users:
        db.add(user)

    db.flush()
    return users


def create_locations(db: Session) -> dict:
    """Create hierarchical test locations."""
    # Create a primary location (home) first
    my_home = models.Location(
        id=uuid.uuid4(),
        name="My Home",
        friendly_name="Demo Home",
        full_path="/My Home",
        is_primary_location=True,
        location_category="Primary",
        address="123 Main Street, Anytown, ST 12345",
        location_type=models.LocationType.RESIDENTIAL,
        description="Primary residence for demo purposes",
    )
    db.add(my_home)
    
    db.flush()
    
    # Create root locations (rooms/areas) as children of primary location
    living_room = models.Location(
        id=uuid.uuid4(),
        name="Living Room",
        parent_id=my_home.id,
        full_path="/My Home/Living Room",
        location_category="Room",
    )
    db.add(living_room)

    bedroom = models.Location(
        id=uuid.uuid4(),
        name="Master Bedroom",
        parent_id=my_home.id,
        full_path="/My Home/Master Bedroom",
        location_category="Room",
    )
    db.add(bedroom)

    kitchen = models.Location(
        id=uuid.uuid4(),
        name="Kitchen",
        parent_id=my_home.id,
        full_path="/My Home/Kitchen",
        location_category="Room",
    )
    db.add(kitchen)

    garage = models.Location(
        id=uuid.uuid4(),
        name="Garage",
        parent_id=my_home.id,
        full_path="/My Home/Garage",
        location_category="Garage",
    )
    db.add(garage)

    office = models.Location(
        id=uuid.uuid4(),
        name="Home Office",
        parent_id=my_home.id,
        full_path="/My Home/Home Office",
        location_category="Room",
    )
    db.add(office)

    db.flush()

    # Create sub-locations
    tv_stand = models.Location(
        id=uuid.uuid4(),
        name="TV Stand",
        parent_id=living_room.id,
        full_path="/My Home/Living Room/TV Stand",
        location_category="Furniture",
    )
    db.add(tv_stand)

    closet = models.Location(
        id=uuid.uuid4(),
        name="Closet",
        parent_id=bedroom.id,
        full_path="/My Home/Master Bedroom/Closet",
        location_category="Room",
    )
    db.add(closet)

    pantry = models.Location(
        id=uuid.uuid4(),
        name="Pantry",
        parent_id=kitchen.id,
        full_path="/My Home/Kitchen/Pantry",
        location_category="Room",
    )
    db.add(pantry)

    workbench = models.Location(
        id=uuid.uuid4(),
        name="Workbench",
        parent_id=garage.id,
        full_path="/My Home/Garage/Workbench",
        location_category="Furniture",
    )
    db.add(workbench)

    db.flush()

    return {
        "my_home": my_home,
        "living_room": living_room,
        "bedroom": bedroom,
        "kitchen": kitchen,
        "garage": garage,
        "office": office,
        "tv_stand": tv_stand,
        "closet": closet,
        "pantry": pantry,
        "workbench": workbench,
    }


def create_items(db: Session, locations: dict, tags: dict) -> list:
    """Create test items with various attributes."""
    items = []

    # Electronics
    tv = models.Item(
        id=uuid.uuid4(),
        name="Samsung 65\" 4K TV",
        description="Smart TV with HDR and built-in streaming apps",
        brand="Samsung",
        model_number="UN65RU8000",
        serial_number="ABC123456789",
        purchase_date=date(2022, 3, 15),
        purchase_price=Decimal("799.99"),
        estimated_value=Decimal("650.00"),
        retailer="Best Buy",
        upc="887276318356",
        location_id=locations["tv_stand"].id,
        warranties=[
            {
                "type": "manufacturer",
                "expiration_date": "2023-03-15",
                "description": "1-year manufacturer warranty",
            },
            {
                "type": "extended",
                "expiration_date": "2025-03-15",
                "description": "3-year extended warranty from Best Buy",
            },
        ],
    )
    tv.tags = [tags["Electronics"]]
    items.append(tv)
    db.add(tv)

    laptop = models.Item(
        id=uuid.uuid4(),
        name="MacBook Pro 14\"",
        description="Apple Silicon M1 Pro, 16GB RAM, 512GB SSD",
        brand="Apple",
        model_number="MK1E3LL/A",
        serial_number="C02DR12QMD6R",
        purchase_date=date(2023, 1, 10),
        purchase_price=Decimal("2499.00"),
        estimated_value=Decimal("2200.00"),
        retailer="Apple Store",
        location_id=locations["office"].id,
        warranties=[
            {
                "type": "manufacturer",
                "expiration_date": "2024-01-10",
                "description": "1-year limited warranty",
            },
        ],
    )
    laptop.tags = [tags["Electronics"], tags["Computers"], tags["Office Supplies"]]
    items.append(laptop)
    db.add(laptop)

    # Appliances
    microwave = models.Item(
        id=uuid.uuid4(),
        name="Panasonic Microwave Oven",
        description="1200W countertop microwave with inverter technology",
        brand="Panasonic",
        model_number="NN-SN966S",
        serial_number="MW98765432",
        purchase_date=date(2021, 6, 20),
        purchase_price=Decimal("189.99"),
        estimated_value=Decimal("150.00"),
        retailer="Amazon",
        location_id=locations["kitchen"].id,
    )
    microwave.tags = [tags["Appliances"], tags["Kitchen"]]
    items.append(microwave)
    db.add(microwave)

    # Tools
    drill = models.Item(
        id=uuid.uuid4(),
        name="DeWalt 20V Cordless Drill",
        description="Brushless motor, 2-speed transmission, LED light",
        brand="DeWalt",
        model_number="DCD771C2",
        serial_number="DW202401234",
        purchase_date=date(2023, 8, 5),
        purchase_price=Decimal("129.00"),
        estimated_value=Decimal("120.00"),
        retailer="Home Depot",
        location_id=locations["workbench"].id,
    )
    drill.tags = [tags["Tools"]]
    items.append(drill)
    db.add(drill)

    # Furniture
    desk = models.Item(
        id=uuid.uuid4(),
        name="Standing Desk",
        description="Electric height-adjustable desk, 60x30 inches",
        brand="Uplift",
        model_number="V2-C",
        purchase_date=date(2022, 11, 1),
        purchase_price=Decimal("599.00"),
        estimated_value=Decimal("550.00"),
        retailer="Uplift Desk",
        location_id=locations["office"].id,
        warranties=[
            {
                "type": "manufacturer",
                "expiration_date": "2032-11-01",
                "description": "10-year warranty on frame and mechanics",
            },
        ],
    )
    desk.tags = [tags["Furniture"], tags["Office Supplies"]]
    items.append(desk)
    db.add(desk)

    # Sports Equipment
    bicycle = models.Item(
        id=uuid.uuid4(),
        name="Trek Mountain Bike",
        description="29er mountain bike, 21-speed, disc brakes",
        brand="Trek",
        model_number="Marlin 7",
        serial_number="WTU12345678",
        purchase_date=date(2023, 5, 15),
        purchase_price=Decimal("849.99"),
        estimated_value=Decimal("800.00"),
        retailer="Local Bike Shop",
        location_id=locations["garage"].id,
    )
    bicycle.tags = [tags["Sports Equipment"], tags["Vehicles"]]
    items.append(bicycle)
    db.add(bicycle)

    # Home & Garden
    vacuum = models.Item(
        id=uuid.uuid4(),
        name="Dyson V11 Cordless Vacuum",
        description="High torque cleaner head, up to 60 minutes run time",
        brand="Dyson",
        model_number="V11 Torque Drive",
        serial_number="DY987654321",
        purchase_date=date(2023, 2, 28),
        purchase_price=Decimal("599.99"),
        estimated_value=Decimal("550.00"),
        retailer="Target",
        upc="885609015927",
        location_id=locations["closet"].id,
        warranties=[
            {
                "type": "manufacturer",
                "expiration_date": "2025-02-28",
                "description": "2-year warranty on parts and labor",
            },
        ],
    )
    vacuum.tags = [tags["Home & Garden"], tags["Appliances"]]
    items.append(vacuum)
    db.add(vacuum)

    # Kitchen Items
    coffee_maker = models.Item(
        id=uuid.uuid4(),
        name="Keurig K-Elite Coffee Maker",
        description="Single serve K-Cup pod coffee maker with iced coffee capability",
        brand="Keurig",
        model_number="K-Elite",
        serial_number="KG20231234",
        purchase_date=date(2023, 9, 10),
        purchase_price=Decimal("169.99"),
        estimated_value=Decimal("160.00"),
        retailer="Walmart",
        location_id=locations["kitchen"].id,
    )
    coffee_maker.tags = [tags["Kitchen"], tags["Appliances"]]
    items.append(coffee_maker)
    db.add(coffee_maker)

    db.flush()
    return items


def create_maintenance_tasks(db: Session, items: list) -> list:
    """Create maintenance tasks for some items."""
    tasks = []

    # Find specific items by name
    bicycle = next((item for item in items if "Bicycle" in item.name or "Trek" in item.name), None)
    vacuum = next((item for item in items if "Vacuum" in item.name or "Dyson" in item.name), None)
    coffee_maker = next((item for item in items if "Coffee" in item.name), None)

    if bicycle:
        # Bicycle tune-up
        task = models.MaintenanceTask(
            id=uuid.uuid4(),
            item_id=bicycle.id,
            name="Annual Bike Tune-up",
            description="Professional tune-up including brake adjustment, gear tuning, and chain lubrication",
            next_due_date=date.today() + timedelta(days=90),
            recurrence_type=models.RecurrenceType.YEARLY,
            recurrence_interval=1,
            last_completed=date.today() - timedelta(days=275),
        )
        tasks.append(task)
        db.add(task)

        # Chain maintenance
        task2 = models.MaintenanceTask(
            id=uuid.uuid4(),
            item_id=bicycle.id,
            name="Chain Lubrication",
            description="Clean and lubricate bicycle chain",
            next_due_date=date.today() + timedelta(days=15),
            recurrence_type=models.RecurrenceType.CUSTOM_DAYS,
            recurrence_interval=30,
            last_completed=date.today() - timedelta(days=15),
        )
        tasks.append(task2)
        db.add(task2)

    if vacuum:
        # Filter replacement
        task = models.MaintenanceTask(
            id=uuid.uuid4(),
            item_id=vacuum.id,
            name="Replace Vacuum Filter",
            description="Replace HEPA filter and clean pre-filter",
            next_due_date=date.today() + timedelta(days=60),
            recurrence_type=models.RecurrenceType.CUSTOM_DAYS,
            recurrence_interval=90,
            last_completed=date.today() - timedelta(days=30),
        )
        tasks.append(task)
        db.add(task)

    if coffee_maker:
        # Descaling
        task = models.MaintenanceTask(
            id=uuid.uuid4(),
            item_id=coffee_maker.id,
            name="Descale Coffee Maker",
            description="Run descaling solution through the machine to remove mineral buildup",
            next_due_date=date.today() + timedelta(days=30),
            recurrence_type=models.RecurrenceType.CUSTOM_DAYS,
            recurrence_interval=90,
        )
        tasks.append(task)
        db.add(task)

    db.flush()
    return tasks
