import uuid
from datetime import datetime, timezone as dt_timezone

from app.models.property import Property
from app.models.property_member import PropertyRole
from app.repositories.property_repository import PropertyRepository
from app.repositories.property_member_repository import PropertyMemberRepository
from app.core.exceptions import LastOwnerError

class PropertyService:
    def __init__(self, property_repo: PropertyRepository, property_member_repo: PropertyMemberRepository):
        self.property_repo = property_repo
        self.property_member_repo = property_member_repo

    async def create_property(
        self,
        owner_id: uuid.UUID,
        name: str,
        address_line: str | None = None,
        city: str | None = None,
        state: str | None = None,
        pincode: str | None = None,
        timezone: str = "Asia/Kolkata",
        currency: str = "INR"
    ) -> Property:
        prop = await self.property_repo.create(
            owner_id=owner_id,
            name=name,
            address_line=address_line,
            city=city,
            state=state,
            pincode=pincode,
            timezone=timezone,
            currency=currency,
            is_active=True,
            created_by=owner_id,
            updated_by=owner_id
        )

        await self.property_member_repo.create(
            property_id=prop.id,
            user_id=owner_id,
            role=PropertyRole.OWNER,
            accepted_at=datetime.now(dt_timezone.utc),
            is_active=True
        )

        return prop

    async def _check_last_owner(self, property_id: uuid.UUID, target_user_id: uuid.UUID, new_role: PropertyRole | None = None):
        """Raises LastOwnerError if target_user_id is the last owner and is being revoked or demoted."""
        members = await self.property_member_repo.list_by_property(property_id, active_only=True)
        target_member = next((m for m in members if m.user_id == target_user_id), None)
        
        if not target_member:
            return 
            
        if target_member.role == PropertyRole.OWNER:
            if new_role != PropertyRole.OWNER:
                owner_count = sum(1 for m in members if m.role == PropertyRole.OWNER)
                if owner_count <= 1:
                    raise LastOwnerError("Cannot remove or demote the last owner of a property.")

    async def change_member_role(self, property_id: uuid.UUID, user_id: uuid.UUID, new_role: str):
        target_member = await self.property_member_repo.get_by_property_and_user(property_id, user_id)
        if not target_member or not target_member.is_active:
            raise ValueError("Target user is not an active member of this property")

        enum_role = PropertyRole(new_role)
        await self._check_last_owner(property_id, user_id, enum_role)
        await self.property_member_repo.update_role(target_member.id, enum_role)
        
    async def revoke_member(self, property_id: uuid.UUID, user_id: uuid.UUID):
        target_member = await self.property_member_repo.get_by_property_and_user(property_id, user_id)
        if not target_member or not target_member.is_active:
            raise ValueError("Target user is not an active member of this property")
            
        await self._check_last_owner(property_id, user_id, None)
        await self.property_member_repo.deactivate(target_member.id)
