from fastapi import APIRouter
from app.api.v1.routers import auth, properties, rooms, guests, payments, stats

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(properties.router, prefix="/properties", tags=["properties"])
api_router.include_router(rooms.router, prefix="/properties/{property_id}/rooms", tags=["rooms"])
api_router.include_router(guests.router, prefix="/properties/{property_id}/guests", tags=["guests"])
api_router.include_router(payments.router, prefix="/properties/{property_id}/payments", tags=["payments"])
api_router.include_router(stats.router, prefix="/properties/{property_id}/stats", tags=["stats"])
