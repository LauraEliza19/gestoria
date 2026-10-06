import uuid

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import CostCenter, Employee, Employment


class CostCenterRepository:
    @staticmethod
    def list_for_organization(
        db: Session,
        organization_id: uuid.UUID,
        *,
        active_only: bool = False,
    ) -> list[CostCenter]:
        query = select(CostCenter).where(CostCenter.organization_id == organization_id)

        if active_only:
            query = query.where(CostCenter.is_active.is_(True))

        query = query.order_by(
            CostCenter.is_active.desc(),
            CostCenter.name,
        )

        return list(db.scalars(query))

    @staticmethod
    def get_for_organization(
        db: Session,
        cost_center_id: uuid.UUID,
        organization_id: uuid.UUID,
    ) -> CostCenter | None:
        return db.scalar(
            select(CostCenter).where(
                CostCenter.id == cost_center_id,
                CostCenter.organization_id == organization_id,
            )
        )

    @staticmethod
    def create(
        db: Session,
        organization_id: uuid.UUID,
        values: dict,
    ) -> CostCenter:
        cost_center = CostCenter(
            organization_id=organization_id,
            **values,
        )
        db.add(cost_center)
        db.commit()
        db.refresh(cost_center)
        return cost_center

    @staticmethod
    def update(
        db: Session,
        cost_center: CostCenter,
        values: dict,
    ) -> CostCenter:
        for field, value in values.items():
            setattr(cost_center, field, value)

        db.commit()
        db.refresh(cost_center)
        return cost_center


class EmployeeRepository:
    @staticmethod
    def list_for_organization(
        db: Session,
        organization_id: uuid.UUID,
        *,
        active_only: bool = False,
    ) -> list[Employee]:
        query = select(Employee).where(Employee.organization_id == organization_id)

        if active_only:
            query = query.where(Employee.is_active.is_(True))

        query = query.order_by(
            Employee.is_active.desc(),
            Employee.full_name,
        )

        return list(db.scalars(query))

    @staticmethod
    def get_for_organization(
        db: Session,
        employee_id: uuid.UUID,
        organization_id: uuid.UUID,
        *,
        for_update: bool = False,
    ) -> Employee | None:
        query = select(Employee).where(
            Employee.id == employee_id,
            Employee.organization_id == organization_id,
        )

        if for_update:
            query = query.with_for_update()

        return db.scalar(query)

    @staticmethod
    def create(
        db: Session,
        organization_id: uuid.UUID,
        values: dict,
    ) -> Employee:
        employee = Employee(
            organization_id=organization_id,
            **values,
        )
        db.add(employee)
        db.commit()
        db.refresh(employee)
        return employee

    @staticmethod
    def update(
        db: Session,
        employee: Employee,
        values: dict,
    ) -> Employee:
        for field, value in values.items():
            setattr(employee, field, value)

        db.commit()
        db.refresh(employee)
        return employee


class EmploymentRepository:
    @staticmethod
    def list_for_employee(
        db: Session,
        organization_id: uuid.UUID,
        employee_id: uuid.UUID,
    ) -> list[Employment]:
        query = (
            select(Employment)
            .where(
                Employment.organization_id == organization_id,
                Employment.employee_id == employee_id,
            )
            .order_by(
                Employment.started_at.desc(),
                Employment.created_at.desc(),
            )
        )

        return list(db.scalars(query))

    @staticmethod
    def get_for_organization(
        db: Session,
        employment_id: uuid.UUID,
        organization_id: uuid.UUID,
        *,
        for_update: bool = False,
    ) -> Employment | None:
        query = select(Employment).where(
            Employment.id == employment_id,
            Employment.organization_id == organization_id,
        )

        if for_update:
            query = query.with_for_update()

        return db.scalar(query)

    @staticmethod
    def get_current_for_employee(
        db: Session,
        organization_id: uuid.UUID,
        employee_id: uuid.UUID,
    ) -> Employment | None:
        return db.scalar(
            select(Employment)
            .where(
                Employment.organization_id == organization_id,
                Employment.employee_id == employee_id,
                Employment.status.in_(("active", "on_leave")),
            )
            .order_by(Employment.started_at.desc())
        )

    @staticmethod
    def create(
        db: Session,
        organization_id: uuid.UUID,
        employee_id: uuid.UUID,
        values: dict,
    ) -> Employment:
        employment = Employment(
            organization_id=organization_id,
            employee_id=employee_id,
            **values,
        )
        db.add(employment)
        db.commit()
        db.refresh(employment)
        return employment

    @staticmethod
    def update(
        db: Session,
        employment: Employment,
        values: dict,
    ) -> Employment:
        for field, value in values.items():
            setattr(employment, field, value)

        db.commit()
        db.refresh(employment)
        return employment


class ManagementOverviewRepository:
    @staticmethod
    def get_for_organization(
        db: Session,
        organization_id: uuid.UUID,
    ) -> dict[str, int]:
        total_employees = db.scalar(
            select(func.count())
            .select_from(Employee)
            .where(Employee.organization_id == organization_id)
        )
        active_employees = db.scalar(
            select(func.count())
            .select_from(Employee)
            .where(
                Employee.organization_id == organization_id,
                Employee.is_active.is_(True),
            )
        )
        active_cost_centers = db.scalar(
            select(func.count())
            .select_from(CostCenter)
            .where(
                CostCenter.organization_id == organization_id,
                CostCenter.is_active.is_(True),
            )
        )
        active_employments = db.scalar(
            select(func.count())
            .select_from(Employment)
            .where(
                Employment.organization_id == organization_id,
                Employment.status == "active",
            )
        )
        employees_on_leave = db.scalar(
            select(func.count())
            .select_from(Employment)
            .where(
                Employment.organization_id == organization_id,
                Employment.status == "on_leave",
            )
        )

        return {
            "total_employees": int(total_employees or 0),
            "active_employees": int(active_employees or 0),
            "active_cost_centers": int(active_cost_centers or 0),
            "active_employments": int(active_employments or 0),
            "employees_on_leave": int(employees_on_leave or 0),
        }
