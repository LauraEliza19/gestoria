"""Interactive first owner creation: python -m app.create_admin. No default password."""

import getpass

from sqlalchemy import select

from app.database import SessionLocal
from app.models import Organization, OrganizationMember, User
from app.schemas import LoginRequest
from app.security import hash_password
from app.seed import slugify
from app.services.auth import is_demo_account


def main():
    name = input("Nome completo: ").strip()
    email = input("E-mail: ").strip().lower()
    company = input("Empresa: ").strip()
    slug = input("Identificador único da empresa (vazio = nome): ").strip() or slugify(
        company
    )
    password = getpass.getpass("Senha (mínimo 12 caracteres): ")
    if len(password) < 12 or password != getpass.getpass("Confirme a senha: "):
        raise SystemExit("Senha curta ou confirmação diferente.")
    LoginRequest(email=email, password=password)
    if (
        not name
        or len(name) > 120
        or not company
        or len(company) > 120
        or not slug
        or len(slug) > 80
    ):
        raise SystemExit("Confira nome, empresa e identificador.")
    user = User(full_name=name, email=email, password_hash=hash_password(password))
    if is_demo_account(user):
        raise SystemExit("Use uma conta real, diferente das contas demo.")
    with SessionLocal() as db:
        if db.scalar(select(User).where(User.email == email)):
            raise SystemExit("Usuário já existe; nenhum dado foi alterado.")
        organization = db.scalar(select(Organization).where(Organization.slug == slug))
        if organization:
            confirmation = input(
                f"Vincular como proprietário à empresa existente '{organization.name}'? Digite VINCULAR: "
            )
            if confirmation != "VINCULAR":
                raise SystemExit("Cancelado; nenhum dado foi alterado.")
        else:
            organization = Organization(name=company, slug=slug)
            db.add(organization)
        db.add(user)
        db.flush()
        db.add(
            OrganizationMember(
                organization_id=organization.id, user_id=user.id, role="owner"
            )
        )
        db.commit()
    print("Administrador criado.")


if __name__ == "__main__":
    main()
