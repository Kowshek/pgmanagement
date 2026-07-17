"""create properties table

Revision ID: d4e5f6g7h8i9
Revises: c3d4e5f6g7h8
Create Date: 2026-07-16 10:15:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd4e5f6g7h8i9'
down_revision: Union[str, None] = 'c3d4e5f6g7h8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'properties',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('owner_id', sa.Uuid(), nullable=False),
        sa.Column('name', sa.Text(), nullable=False),
        sa.Column('address_line', sa.Text(), nullable=True),
        sa.Column('city', sa.Text(), nullable=True),
        sa.Column('state', sa.Text(), nullable=True),
        sa.Column('pincode', sa.String(length=10), nullable=True),
        sa.Column('country', sa.CHAR(length=2), server_default=sa.text("'IN'"), nullable=False),
        sa.Column('timezone', sa.Text(), server_default=sa.text("'Asia/Kolkata'"), nullable=False),
        sa.Column('currency', sa.CHAR(length=3), server_default=sa.text("'INR'"), nullable=False),
        sa.Column('is_active', sa.Boolean(), server_default=sa.text('true'), nullable=False),
        sa.Column('created_by', sa.Uuid(), nullable=True),
        sa.Column('updated_by', sa.Uuid(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        
        sa.ForeignKeyConstraint(['owner_id'], ['users.id'], name=op.f('fk_properties__owner_id__users'), ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], name=op.f('fk_properties__created_by__users'), ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['updated_by'], ['users.id'], name=op.f('fk_properties__updated_by__users'), ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_properties'))
    )
    
    # Attach trigger for automatic updated_at
    op.execute(
        """
        CREATE TRIGGER update_properties_updated_at
        BEFORE UPDATE ON properties
        FOR EACH ROW
        EXECUTE FUNCTION set_updated_at();
        """
    )


def downgrade() -> None:
    op.execute("DROP TRIGGER IF EXISTS update_properties_updated_at ON properties;")
    op.drop_table('properties')
