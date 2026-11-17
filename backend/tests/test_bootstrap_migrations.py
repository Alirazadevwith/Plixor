import pytest

from scripts.bootstrap_migrations import Action, decide_action


def test_empty_database_is_upgraded():
    assert decide_action(current_revision=None, has_domain_tables=False) == Action.upgrade


def test_database_predating_migrations_is_stamped():
    """Tables from create_all but no recorded revision: a plain upgrade would
    try to CREATE TABLE over existing tables and fail."""
    assert decide_action(current_revision=None, has_domain_tables=True) == Action.stamp


def test_already_managed_database_is_upgraded():
    assert decide_action(current_revision="83b1d88dd9e1", has_domain_tables=True) == Action.upgrade


def test_empty_version_table_still_counts_as_unmanaged():
    """A failed 'alembic upgrade' creates alembic_version and leaves it empty.

    Testing for the table's presence reads that broken half-state as managed
    and retries the upgrade, which fails the same way. The revision row is
    what decides.
    """
    assert decide_action(current_revision=None, has_domain_tables=True) == Action.stamp


def test_revision_without_domain_tables_is_upgraded():
    assert decide_action(current_revision="83b1d88dd9e1", has_domain_tables=False) == Action.upgrade


@pytest.mark.parametrize(
    "revision,has_tables",
    [(None, False), (None, True), ("abc123", True), ("abc123", False)],
)
def test_every_state_resolves_to_a_known_action(revision, has_tables):
    assert decide_action(revision, has_tables) in (Action.stamp, Action.upgrade)
