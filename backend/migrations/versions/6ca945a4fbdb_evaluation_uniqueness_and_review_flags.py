"""evaluation uniqueness and review flags

Adds the database-level guarantee of one Evaluation per Submission, plus the
flags that let grading say "this needs a human" instead of silently recording
a zero, plus the `grading_failed` submission status.

Existing rows are deduplicated first: the application guard was a
read-then-write, so a database in service may already contain two evaluations
for one submission. The newest is kept, since that is the one the API already
showed (`get_evaluation` orders by `evaluated_at` descending) and the one a
teacher's override would have updated.

Revision ID: 6ca945a4fbdb
Revises: 64bb9a0a60e6
Create Date: 2026-11-17 15:35:36.585380
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "6ca945a4fbdb"
down_revision: Union[str, None] = "64bb9a0a60e6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

UNIQUE_NAME = "uq_evaluations_submission_id"

SUBMISSION_STATUS = sa.Enum(
    "in_progress",
    "submitted",
    "evaluated",
    "grading_failed",
    name="submissionstatus",
)


def _deduplicate_evaluations() -> None:
    """Keep the newest Evaluation per submission; delete the rest.

    Child rows (criterion_scores, mcq_results) go with them via ON DELETE
    CASCADE, so no orphan scores are left pointing at a deleted evaluation.
    """
    conn = op.get_bind()
    duplicates = conn.execute(
        sa.text(
            """
            SELECT id FROM evaluations
            WHERE id NOT IN (
                SELECT id FROM (
                    SELECT id,
                           ROW_NUMBER() OVER (
                               PARTITION BY submission_id
                               ORDER BY evaluated_at DESC, id DESC
                           ) AS rn
                    FROM evaluations
                ) ranked
                WHERE rn = 1
            )
            """
        )
    ).fetchall()

    if not duplicates:
        return

    ids = [row[0] for row in duplicates]
    print(f"  deduplicating {len(ids)} surplus evaluation row(s) before adding the constraint")
    conn.execute(
        sa.text("DELETE FROM evaluations WHERE id IN :ids").bindparams(
            sa.bindparam("ids", value=ids, expanding=True)
        )
    )


def upgrade() -> None:
    _deduplicate_evaluations()

    with op.batch_alter_table("evaluations", schema=None) as batch_op:
        batch_op.add_column(
            sa.Column(
                "needs_review",
                sa.Boolean(),
                server_default="0",
                nullable=False,
            )
        )
        batch_op.add_column(sa.Column("review_reason", sa.Text(), nullable=True))
        batch_op.create_unique_constraint(UNIQUE_NAME, ["submission_id"])

    with op.batch_alter_table("submissions", schema=None) as batch_op:
        batch_op.alter_column(
            "status",
            existing_type=sa.VARCHAR(length=11),
            type_=SUBMISSION_STATUS,
            existing_nullable=False,
        )


def downgrade() -> None:
    with op.batch_alter_table("submissions", schema=None) as batch_op:
        batch_op.alter_column(
            "status",
            existing_type=SUBMISSION_STATUS,
            type_=sa.VARCHAR(length=11),
            existing_nullable=False,
        )

    with op.batch_alter_table("evaluations", schema=None) as batch_op:
        batch_op.drop_constraint(UNIQUE_NAME, type_="unique")
        batch_op.drop_column("review_reason")
        batch_op.drop_column("needs_review")
