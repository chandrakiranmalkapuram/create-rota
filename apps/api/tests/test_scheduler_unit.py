from datetime import date

import pytest

from app.schemas.scheduler import (
    BandSpec,
    BreakPolicySpec,
    BreakTierSpec,
    SchedulerInputSpec,
    StaffContractSpec,
    StaffSpec,
    StaffUnavailabilitySpec,
    calculate_shift_durations,
)
from app.services.scheduler import generate_rota_schedule


def test_break_calculation_under_threshold():
    # 4 hours shift (09:00 to 13:00) -> 240 gross mins, 0 break, 4.0 paid hours
    res = calculate_shift_durations("09:00", "13:00")
    assert res.gross_minutes == 240
    assert res.unpaid_break_minutes == 0
    assert res.paid_hours == 4.0
    assert not res.is_overnight
    assert "0m unpaid break" in res.assumptions_summary


def test_break_calculation_standard_thresholds():
    # Exactly 6 hours (09:00 to 15:00) -> 360 gross mins, 30 min break, 5.5 paid hours
    res6 = calculate_shift_durations("09:00", "15:00")
    assert res6.gross_minutes == 360
    assert res6.unpaid_break_minutes == 30
    assert res6.paid_hours == 5.5
    assert "30m unpaid break" in res6.assumptions_summary

    # Exactly 8 hours (09:00 to 17:00) -> 480 gross mins, 45 min break, 7.25 paid hours
    res8 = calculate_shift_durations("09:00", "17:00")
    assert res8.gross_minutes == 480
    assert res8.unpaid_break_minutes == 45
    assert res8.paid_hours == 7.25
    assert "45m unpaid break" in res8.assumptions_summary


def test_break_calculation_overnight_shift():
    # 22:00 to 06:00 (8 hours overnight) -> 480 gross mins, 45 min break, 7.25 paid hours
    res = calculate_shift_durations("22:00", "06:00")
    assert res.gross_minutes == 480
    assert res.unpaid_break_minutes == 45
    assert res.paid_hours == 7.25
    assert res.is_overnight


def test_break_calculation_custom_policy():
    custom_policy = BreakPolicySpec(
        name="custom_uk_statutory",
        tiers=[BreakTierSpec(threshold_minutes=360, break_minutes=20, is_unpaid=True)],
    )
    res = calculate_shift_durations("09:00", "15:00", custom_policy)
    assert res.unpaid_break_minutes == 20
    assert res.paid_minutes == 340
    assert res.paid_hours == round(340 / 60.0, 2)


def test_break_calculation_invalid_identical_times():
    with pytest.raises(ValueError, match="cannot be identical"):
        calculate_shift_durations("09:00", "09:00")


def test_deterministic_reproducibility():
    # Setup 3 staff and 5 bands
    staff = [
        StaffSpec(
            id="s1",
            first_name="Alice",
            last_name="Anderson",
            contract=StaffContractSpec(contracted_hours_per_week=20.0, max_shifts_per_week=3),
        ),
        StaffSpec(
            id="s2",
            first_name="Bob",
            last_name="Brown",
            contract=StaffContractSpec(contracted_hours_per_week=20.0, max_shifts_per_week=3),
        ),
        StaffSpec(
            id="s3",
            first_name="Charlie",
            last_name="Clark",
            contract=StaffContractSpec(contracted_hours_per_week=20.0, max_shifts_per_week=3),
        ),
    ]

    bands = [
        BandSpec(id="b1", date=date(2026, 11, 2), start_time="09:00", end_time="17:00", target_staff_count=1),
        BandSpec(id="b2", date=date(2026, 11, 3), start_time="09:00", end_time="17:00", target_staff_count=1),
        BandSpec(id="b3", date=date(2026, 11, 4), start_time="09:00", end_time="17:00", target_staff_count=1),
        BandSpec(id="b4", date=date(2026, 11, 5), start_time="09:00", end_time="17:00", target_staff_count=1),
        BandSpec(id="b5", date=date(2026, 11, 6), start_time="09:00", end_time="17:00", target_staff_count=1),
    ]

    req1 = SchedulerInputSpec(
        rota_id="r1",
        start_date=date(2026, 11, 2),
        end_date=date(2026, 11, 6),
        bands=bands,
        staff=staff,
        random_seed=42,
    )
    res1 = generate_rota_schedule(req1)

    req2 = SchedulerInputSpec(
        rota_id="r1",
        start_date=date(2026, 11, 2),
        end_date=date(2026, 11, 6),
        bands=bands,
        staff=staff,
        random_seed=42,
    )
    res2 = generate_rota_schedule(req2)

    assert res1.status == "feasible"
    assert res2.status == "feasible"
    assert res1.coverage_score == 100.0
    assert res2.coverage_score == 100.0
    assert len(res1.shifts) == len(res2.shifts) == 5

    # Check identical assignments
    assignments1 = [(s.staff_id, s.date, s.start_time) for s in res1.shifts]
    assignments2 = [(s.staff_id, s.date, s.start_time) for s in res2.shifts]
    assert assignments1 == assignments2


def test_feasible_outcome():
    staff = [
        StaffSpec(
            id="s1",
            first_name="Dana",
            last_name="Doe",
            contract=StaffContractSpec(contracted_hours_per_week=37.5),
        ),
    ]
    bands = [
        BandSpec(id="b1", date=date(2026, 11, 2), start_time="09:00", end_time="17:00", target_staff_count=1),
    ]
    req = SchedulerInputSpec(
        rota_id="r_feas",
        start_date=date(2026, 11, 2),
        end_date=date(2026, 11, 2),
        bands=bands,
        staff=staff,
    )
    res = generate_rota_schedule(req)
    assert res.status == "feasible"
    assert res.coverage_score == 100.0
    assert len(res.shifts) == 1
    assert res.shifts[0].staff_id == "s1"
    assert res.shifts[0].paid_hours == 7.25


def test_partially_feasible_and_relaxation_suggestions():
    # Only 1 chef exists, but capped at 1 shift. 2 chef shifts required.
    chef = StaffSpec(
        id="chef1",
        first_name="Gordon",
        last_name="Ramsay",
        skill_ids={"skill_chef"},
        contract=StaffContractSpec(max_shifts_per_week=1),
    )
    bands = [
        BandSpec(
            id="b1",
            date=date(2026, 11, 2),
            start_time="10:00",
            end_time="18:00",
            target_staff_count=1,
            skill_id="skill_chef",
            skill_name="Head Chef",
        ),
        BandSpec(
            id="b2",
            date=date(2026, 11, 3),
            start_time="10:00",
            end_time="18:00",
            target_staff_count=1,
            skill_id="skill_chef",
            skill_name="Head Chef",
        ),
    ]
    req = SchedulerInputSpec(
        rota_id="r_partial",
        start_date=date(2026, 11, 2),
        end_date=date(2026, 11, 3),
        bands=bands,
        staff=[chef],
    )
    res = generate_rota_schedule(req)
    assert res.status == "partially_feasible"
    assert res.coverage_score == 50.0
    assert len(res.shifts) == 1
    assert len(res.relaxation_suggestions) > 0
    # Should recommend relaxing max shifts for Gordon Ramsay
    shift_cap_sug = next(
        (s for s in res.relaxation_suggestions if s.category == "max_shifts"), None
    )
    assert shift_cap_sug is not None
    assert "Gordon Ramsay" in shift_cap_sug.title
    assert shift_cap_sug.is_confirmed is False  # Correctly labeled heuristic recommendation


def test_infeasible_missing_skill_in_workspace():
    # Band requires "skill_sommelier", no staff have it
    server = StaffSpec(
        id="s1",
        first_name="Sam",
        last_name="Server",
        skill_ids={"skill_waiter"},
    )
    bands = [
        BandSpec(
            id="b1",
            date=date(2026, 11, 2),
            start_time="18:00",
            end_time="23:00",
            target_staff_count=1,
            skill_id="skill_sommelier",
            skill_name="Sommelier",
        ),
    ]
    req = SchedulerInputSpec(
        rota_id="r_skill_missing",
        start_date=date(2026, 11, 2),
        end_date=date(2026, 11, 2),
        bands=bands,
        staff=[server],
    )
    res = generate_rota_schedule(req)
    assert res.status == "partially_feasible"
    assert res.coverage_score == 0.0
    skill_sug = next((s for s in res.relaxation_suggestions if s.category == "skill"), None)
    assert skill_sug is not None
    assert skill_sug.is_confirmed is True  # Confirmed mathematical finding
    assert "Zero active staff" in skill_sug.description


def test_infeasible_zero_active_staff():
    bands = [
        BandSpec(id="b1", date=date(2026, 11, 2), start_time="09:00", end_time="17:00", target_staff_count=1),
    ]
    req = SchedulerInputSpec(
        rota_id="r_no_staff",
        start_date=date(2026, 11, 2),
        end_date=date(2026, 11, 2),
        bands=bands,
        staff=[],
    )
    res = generate_rota_schedule(req)
    assert res.status == "infeasible"
    assert res.coverage_score == 0.0
    assert any("No active staff members" in d.message for d in res.diagnostics)


def test_timeout_handling():
    # Setup large requirement and virtually 0 time limit
    bands = [
        BandSpec(id=f"b_{i}", date=date(2026, 11, 2), start_time="09:00", end_time="17:00", target_staff_count=5)
        for i in range(10)
    ]
    staff = [
        StaffSpec(id=f"s_{i}", first_name=f"Staff{i}", last_name="Test")
        for i in range(20)
    ]
    # Set time limit to 0.0000001s to force solver timeout
    req = SchedulerInputSpec(
        rota_id="r_timeout",
        start_date=date(2026, 11, 2),
        end_date=date(2026, 11, 2),
        bands=bands,
        staff=staff,
        time_limit_seconds=0.000001,
    )
    res = generate_rota_schedule(req)
    # The solver handles UNKNOWN as timeout without crashing
    assert res.status in ("timeout", "feasible", "partially_feasible")
    if res.status == "timeout":
        assert any("reached time limit" in d.message for d in res.diagnostics)


def test_unavailability_block_respected():
    # Staff on approved holiday
    staff = [
        StaffSpec(
            id="s1",
            first_name="Holiday",
            last_name="Taker",
            unavailability_blocks=[
                StaffUnavailabilitySpec(
                    start_date=date(2026, 11, 2),
                    end_date=date(2026, 11, 2),
                    reason_category="annual_leave",
                )
            ],
        )
    ]
    bands = [
        BandSpec(id="b1", date=date(2026, 11, 2), start_time="09:00", end_time="17:00", target_staff_count=1),
    ]
    req = SchedulerInputSpec(
        rota_id="r_unavail",
        start_date=date(2026, 11, 2),
        end_date=date(2026, 11, 2),
        bands=bands,
        staff=staff,
    )
    res = generate_rota_schedule(req)
    assert res.status == "partially_feasible"
    assert len(res.shifts) == 0
