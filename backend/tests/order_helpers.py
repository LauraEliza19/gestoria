import uuid


def secure_order(client, *, headers, json):
    proposal = client.post(
        "/api/orders/proposals",
        headers={**headers, "Idempotency-Key": str(uuid.uuid4())},
        json=json,
    )
    if proposal.status_code != 201:
        return proposal
    data = proposal.json()
    return client.post(
        f"/api/orders/proposals/{data['operation_id']}/confirm",
        headers=headers,
        json={"envelope": data["envelope"]},
    )
