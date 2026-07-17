"""create payments table

Revision ID: h8i9j0k1l2m3
Revises: g7h8i9j0k1l2
Create Date: 2026-07-16 10:46:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'h8i9j0k1l2m3'
down_revision: Union[str, None] = 'g7h8i9j0k1l2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create ENUMs
    op.execute("CREATE TYPE payment_method AS ENUM ('upi', 'cash', 'bank_transfer', 'card');")

    op.create_table(
        'payments',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('property_id', sa.Uuid(), nullable=False),
        sa.Column('guest_id', sa.Uuid(), nullable=False),
        sa.Column('amount', sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column('method', postgresql.ENUM('upi', 'cash', 'bank_transfer', 'card', name='payment_method', create_type=False), nullable=False),
        sa.Column('for_month', sa.Date(), nullable=False),
        sa.Column('paid_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('recorded_by', sa.Uuid(), nullable=True),
        sa.Column('idempotency_key', sa.Uuid(), nullable=False),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        
        sa.CheckConstraint('amount > 0', name=op.f('chk_payments__amount_positive')),
        sa.CheckConstraint("date_trunc('month', for_month) = for_month", name=op.f('chk_payments__for_month_first_day')),
        
        sa.ForeignKeyConstraint(['property_id'], ['properties.id'], name=op.f('fk_payments__property_id__properties'), ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['guest_id'], ['guests.id'], name=op.f('fk_payments__guest_id__guests'), ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['recorded_by'], ['users.id'], name=op.f('fk_payments__recorded_by__users'), ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_payments')),
        sa.UniqueConstraint('property_id', 'idempotency_key', name=op.f('uq_payments__property_id_idempotency_key'))
    )

    op.execute(
        """
        CREATE TRIGGER update_payments_updated_at
        BEFORE UPDATE ON payments
        FOR EACH ROW
        EXECUTE FUNCTION set_updated_at();
        """
    )


def downgrade() -> None:
    op.execute("DROP TRIGGER IF EXISTS update_payments_updated_at ON payments;")
    op.drop_table('payments')
    op.execute("DROP TYPE payment_method;")
