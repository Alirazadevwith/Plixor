"""Every API route must require authentication.

Written as a guard over the dependency refactor: eleven hand-rolled auth checks
were replaced by shared dependencies, and the failure mode of that kind of
change is a route that silently stops checking.
"""

import pytest

from main import app

PUBLIC_PATHS = {"/", "/health", "/api/auth/login", "/api/auth/register"}

AUTH_DEPENDENCY_NAMES = {
    "get_current_user",
    "get_current_student",
    "require_teacher",
    "require_admin",
    "require_student",
    "get_owned_exam",
    "get_owned_section",
    "get_accessible_exam",
}


def _api_routes():
    for route in app.routes:
        path = getattr(route, "path", None)
        if not path or path in PUBLIC_PATHS:
            continue
        if not path.startswith("/api/"):
            continue
        for method in sorted(getattr(route, "methods", set()) - {"HEAD", "OPTIONS"}):
            yield method, path, route


def _dependency_names(route) -> set:
    """Every dependency reachable from this route, transitively."""
    names, stack = set(), list(route.dependant.dependencies)
    while stack:
        dep = stack.pop()
        if dep.call is not None:
            names.add(getattr(dep.call, "__name__", ""))
        stack.extend(dep.dependencies)
    return names


@pytest.mark.parametrize(
    "method,path,route",
    [pytest.param(m, p, r, id=f"{m} {p}") for m, p, r in _api_routes()],
)
def test_route_requires_authentication(method, path, route):
    names = _dependency_names(route)
    assert names & AUTH_DEPENDENCY_NAMES, (
        f"{method} {path} has no authentication dependency; "
        f"its dependencies are {sorted(n for n in names if n)}"
    )


def test_the_guard_itself_sees_a_meaningful_number_of_routes():
    # If route discovery silently broke, the parametrized test above would
    # vacuously pass with zero cases.
    assert len(list(_api_routes())) >= 30
