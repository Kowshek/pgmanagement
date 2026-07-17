"""create property_members table

Revision ID: e5f6g7h8i9j0
Revises: d4e5f6g7h8i9
Create Date: 2026-07-16 10:20:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'e5f6g7h8i9j0'
down_revision: Union[str, None] = 'd4e5f6g7h8i9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("CREATE TYPE property_role AS ENUM ('owner', 'manager', 'staff');")

    op.create_table(
        'property_members',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('property_id', sa.Uuid(), nullable=False),
        sa.Column('user_id', sa.Uuid(), nullable=False),
        sa.Column('role', postgresql.ENUM('owner', 'manager', 'staff', name='property_role', create_type=False), nullable=False),
        sa.Column('invited_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('accepted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('is_active', sa.Boolean(), server_default=sa.text('true'), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        
        sa.ForeignKeyConstraint(['property_id'], ['properties.id'], name=op.f('fk_property_members__property_id__properties'), ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], name=op.f('fk_property_members__user_id__users'), ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_property_members')),
        sa.UniqueConstraint('property_id', 'user_id', name=op.f('uq_property_members__property_id_user_id'))
    )
    
    op.execute(
        """
        CREATE TRIGGER update_property_members_updated_at
        BEFORE UPDATE ON property_members
        FOR EACH ROW
        EXECUTE FUNCTION set_updated_at();
        """
    )


def downgrade() -> None:
    op.execute("DROP TRIGGER IF EXISTS update_property_members_updated_at ON property_members;")
    op.drop_table('property_members')
    op.execute("DROP TYPE property_role;")
