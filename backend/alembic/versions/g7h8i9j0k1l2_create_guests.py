"""create guests table

Revision ID: g7h8i9j0k1l2
Revises: f6g7h8i9j0k1
Create Date: 2026-07-16 10:36:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'g7h8i9j0k1l2'
down_revision: Union[str, None] = 'f6g7h8i9j0k1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create ENUMs
    op.execute("CREATE TYPE guest_type AS ENUM ('permanent', 'temporary');")
    op.execute("CREATE TYPE stay_unit AS ENUM ('days', 'months', 'years');")
    op.execute("CREATE TYPE food_type AS ENUM ('veg', 'non_veg', 'eggetarian');")

    op.create_table(
        'guests',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('property_id', sa.Uuid(), nullable=False),
        sa.Column('room_id', sa.Uuid(), nullable=False),
        sa.Column('full_name', sa.Text(), nullable=False),
        sa.Column('phone', sa.String(length=20), nullable=False),
        sa.Column('aadhar_number_encrypted', sa.LargeBinary(), nullable=True),
        sa.Column('aadhar_last4', sa.String(length=4), nullable=True),
        sa.Column('permanent_address', sa.Text(), nullable=True),
        sa.Column('guest_type', postgresql.ENUM('permanent', 'temporary', name='guest_type', create_type=False), server_default=sa.text("'permanent'"), nullable=False),
        sa.Column('stay_duration', sa.SmallInteger(), nullable=True),
        sa.Column('stay_unit', postgresql.ENUM('days', 'months', 'years', name='stay_unit', create_type=False), nullable=True),
        sa.Column('monthly_rent', sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column('advance_paid', sa.Numeric(precision=10, scale=2), nullable=True),
        sa.Column('has_food', sa.Boolean(), server_default=sa.text('false'), nullable=False),
        sa.Column('food_type', postgresql.ENUM('veg', 'non_veg', 'eggetarian', name='food_type', create_type=False), nullable=True),
        sa.Column('active', sa.Boolean(), server_default=sa.text('true'), nullable=False),
        sa.Column('joined_at', sa.Date(), nullable=False),
        sa.Column('moved_out_at', sa.Date(), nullable=True),
        sa.Column('created_by', sa.Uuid(), nullable=True),
        sa.Column('updated_by', sa.Uuid(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        
        sa.CheckConstraint('monthly_rent >= 0', name=op.f('chk_guests__monthly_rent')),
        sa.CheckConstraint('advance_paid IS NULL OR advance_paid >= 0', name=op.f('chk_guests__advance_paid')),
        sa.CheckConstraint('active = true OR moved_out_at IS NOT NULL', name=op.f('chk_guests__active_moved_out')),
        
        sa.ForeignKeyConstraint(['property_id'], ['properties.id'], name=op.f('fk_guests__property_id__properties'), ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['room_id'], ['rooms.id'], name=op.f('fk_guests__room_id__rooms'), ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], name=op.f('fk_guests__created_by__users'), ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['updated_by'], ['users.id'], name=op.f('fk_guests__updated_by__users'), ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_guests'))
    )

    op.execute(
        """
        CREATE TRIGGER update_guests_updated_at
        BEFORE UPDATE ON guests
        FOR EACH ROW
        EXECUTE FUNCTION set_updated_at();
        """
    )


def downgrade() -> None:
    op.execute("DROP TRIGGER IF EXISTS update_guests_updated_at ON guests;")
    op.drop_table('guests')
    op.execute("DROP TYPE guest_type;")
    op.execute("DROP TYPE stay_unit;")
    op.execute("DROP TYPE food_type;")
