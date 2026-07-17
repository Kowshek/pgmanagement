from datetime import date
from app.models.guest import Guest
from app.models.payment import Payment

def paid_for_month(payments: list[Payment], target_month: date) -> float:
    """
    Calculates the total amount paid by summing all payments
    matching exactly the target_month.
    """
    total = sum(float(p.amount) for p in payments if p.for_month == target_month)
    return total

def balance_for_month(guest: Guest, payments: list[Payment], target_month: date) -> float:
    """
    Calculates the remaining balance for a given month by subtracting
    the total paid for that month from the guest's monthly rent.
    Ensures balance doesn't go below 0 (if overpaid).
    """
    paid = paid_for_month(payments, target_month)
    return max(0.0, float(guest.monthly_rent) - paid)
