from app.repositories.copilot import CopilotRepository
from app.repositories.customers import CustomerRepository, CustomerSummary
from app.repositories.dashboard import DashboardRepository, DashboardSnapshot
from app.repositories.fiscal import FiscalDocumentRepository
from app.repositories.management import (
    CostCenterRepository,
    EmployeeRecordRepository,
    EmployeeRepository,
    EmploymentRepository,
    ManagementOverviewRepository,
)
from app.repositories.orders import OrderItemRepository, OrderRepository
from app.repositories.products import ProductRepository
from app.repositories.quotes import QuoteItemRepository, QuoteRepository
from app.repositories.users import OrganizationRepository, UserRepository
from app.repositories.finance import FinanceCategoryRepository, FinanceEntryRepository

__all__ = [
    "CopilotRepository",
    "CostCenterRepository",
    "CustomerRepository",
    "CustomerSummary",
    "DashboardRepository",
    "DashboardSnapshot",
    "EmployeeRecordRepository",
    "EmployeeRepository",
    "EmploymentRepository",
    "FiscalDocumentRepository",
    "ManagementOverviewRepository",
    "OrderItemRepository",
    "OrderRepository",
    "OrganizationRepository",
    "ProductRepository",
    "QuoteItemRepository",
    "QuoteRepository",
    "UserRepository",
    "FinanceCategoryRepository",
    "FinanceEntryRepository",
]
