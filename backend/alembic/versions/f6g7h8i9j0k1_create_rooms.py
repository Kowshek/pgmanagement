"""create rooms table

Revision ID: f6g7h8i9j0k1
Revises: e5f6g7h8i9j0
Create Date: 2026-07-16 10:28:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'f6g7h8i9j0k1'
down_revision: Union[str, None] = 'e5f6g7h8i9j0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("CREATE TYPE room_type AS ENUM ('single', 'double', 'triple', 'quad', 'custom');")

    op.create_table(
        'rooms',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('property_id', sa.Uuid(), nullable=False),
        sa.Column('room_number', sa.String(length=20), nullable=False),
        sa.Column('room_type', postgresql.ENUM('single', 'double', 'triple', 'quad', 'custom', name='room_type', create_type=False), nullable=False),
        sa.Column('custom_type_label', sa.Text(), nullable=True),
        sa.Column('capacity', sa.SmallInteger(), nullable=False),
        sa.Column('is_ac', sa.Boolean(), server_default=sa.text('false'), nullable=False),
        sa.Column('advance_details', sa.Numeric(precision=10, scale=2), nullable=True),
        sa.Column('is_active', sa.Boolean(), server_default=sa.text('true'), nullable=False),
        sa.Column('created_by', sa.Uuid(), nullable=True),
        sa.Column('updated_by', sa.Uuid(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        
        sa.CheckConstraint('capacity BETWEEN 1 AND 20', name=op.f('chk_rooms__capacity')),
        sa.ForeignKeyConstraint(['property_id'], ['properties.id'], name=op.f('fk_rooms__property_id__properties'), ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], name=op.f('fk_rooms__created_by__users'), ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['updated_by'], ['users.id'], name=op.f('fk_rooms__updated_by__users'), ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_rooms'))
    )

    op.create_index(
        'ix_rooms__property_id_room_number_unique',
        'rooms',
        ['property_id', 'room_number'],
        unique=True,
        postgresql_where=sa.text('deleted_at IS NULL')
    )
    
    op.execute(
        """
        CREATE TRIGGER update_rooms_updated_at
        BEFORE UPDATE ON rooms
        FOR EACH ROW
        EXECUTE FUNCTION set_updated_at();
        """
    )


def downgrade() -> None:
    op.execute("DROP TRIGGER IF EXISTS update_rooms_updated_at ON rooms;")
    op.drop_index('ix_rooms__property_id_room_number_unique', table_name='rooms', postgresql_where=sa.text('deleted_at IS NULL'))
    op.drop_table('rooms')
    op.execute("DROP TYPE room_type;")
