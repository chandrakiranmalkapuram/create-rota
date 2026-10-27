from __future__ import annotations

import csv
import io
from datetime import UTC, datetime
from typing import TYPE_CHECKING, Any, Literal

from app.schemas.scheduler import BreakPolicySpec
from app.services.scheduler import calculate_shift_durations

if TYPE_CHECKING:
    from app.models.rota import Rota


def sanitize_cell(value: Any) -> Any:
    """
    Prevent formula injection in CSV and spreadsheet exports.
    If the stripped string begins with =, +, -, @, or control characters,
    prefix with a single quote (') while preserving legitimate numeric numbers (ints/floats).
    """
    if value is None:
        return ""
    if isinstance(value, (int, float)):
        return value
    if isinstance(value, str):
        s_val = value.strip(" \t\r\n")
        if s_val and s_val[0] in ("=", "+", "-", "@", "\t", "\r"):
            return f"'{value}"
        return value
    return str(value)


def _get_shift_data(rota: Rota, view: Literal["staff", "day"], include_notes: bool) -> list[dict[str, Any]]:
    """Extract and compute authoritative shift rows for export."""
    policy = BreakPolicySpec.from_dict(rota.break_policy) if rota.break_policy else BreakPolicySpec()

    rows: list[dict[str, Any]] = []
    for s in rota.shifts:
        staff = s.staff_member
        staff_name = f"{staff.first_name} {staff.last_name}" if staff else "Unassigned"
        category = (staff.category.replace("_", " ").title() if staff and staff.category else "Full Time")
        skill_name = s.skill.name if s.skill else "General"

        duration_res = calculate_shift_durations(s.start_time, s.end_time, policy)
        unpaid_break = s.unpaid_break_minutes if s.unpaid_break_minutes is not None else duration_res.unpaid_break_minutes
        paid_minutes = max(0, duration_res.gross_minutes - unpaid_break)
        paid_hours = round(paid_minutes / 60.0, 2)

        day_name = s.date.strftime("%A")
        date_str = s.date.isoformat()

        row: dict[str, Any] = {
            "staff_name": staff_name,
            "category": category,
            "date": date_str,
            "day": day_name,
            "start_time": s.start_time,
            "end_time": s.end_time,
            "time_band": f"{s.start_time}–{s.end_time}",
            "unpaid_break": unpaid_break,
            "paid_hours": paid_hours,
            "skill": skill_name,
            "notes": s.notes if include_notes and s.notes else "",
        }
        rows.append(row)

    if view == "staff":
        rows.sort(key=lambda r: (r["staff_name"], r["date"], r["start_time"]))
    else:  # view == "day"
        rows.sort(key=lambda r: (r["date"], r["start_time"], r["staff_name"]))

    return rows


# ---------------------------------------------------------
# CSV Export
# ---------------------------------------------------------

def generate_rota_csv(
    rota: Rota,
    view: Literal["staff", "day"] = "staff",
    include_notes: bool = False,
) -> bytes:
    """Generate UTF-8 CSV with BOM for spreadsheet friendliness."""
    rows = _get_shift_data(rota, view, include_notes)
    output = io.StringIO()
    writer = csv.writer(output, quoting=csv.QUOTE_MINIMAL)

    # Metadata Header
    writer.writerow([sanitize_cell(f"Create Rota — {rota.name}")])
    writer.writerow([sanitize_cell(f"Period: {rota.start_date} to {rota.end_date} | Status: {rota.status.capitalize()} | Generated: {datetime.now(UTC).strftime('%Y-%m-%d %H:%M UTC')}")])
    writer.writerow([])  # blank row

    if view == "staff":
        headers = ["Staff Member", "Category", "Date", "Day", "Start Time", "End Time", "Unpaid Break (mins)", "Paid Hours", "Role / Skill"]
        if include_notes:
            headers.append("Notes")
        writer.writerow([sanitize_cell(h) for h in headers])

        total_paid_hours = 0.0
        for r in rows:
            total_paid_hours += r["paid_hours"]
            row_data = [
                sanitize_cell(r["staff_name"]),
                sanitize_cell(r["category"]),
                sanitize_cell(r["date"]),
                sanitize_cell(r["day"]),
                sanitize_cell(r["start_time"]),
                sanitize_cell(r["end_time"]),
                sanitize_cell(r["unpaid_break"]),
                r["paid_hours"],
                sanitize_cell(r["skill"]),
            ]
            if include_notes:
                row_data.append(sanitize_cell(r["notes"]))
            writer.writerow(row_data)

        # Summary footer
        writer.writerow([])
        summary_row = ["Total Scheduled Hours", "", "", "", "", "", "", round(total_paid_hours, 2), ""]
        if include_notes:
            summary_row.append("")
        writer.writerow(summary_row)

    else:  # day view
        headers = ["Date", "Day", "Time Band", "Staff Member", "Category", "Role / Skill", "Unpaid Break (mins)", "Paid Hours"]
        if include_notes:
            headers.append("Notes")
        writer.writerow([sanitize_cell(h) for h in headers])

        total_paid_hours = 0.0
        for r in rows:
            total_paid_hours += r["paid_hours"]
            row_data = [
                sanitize_cell(r["date"]),
                sanitize_cell(r["day"]),
                sanitize_cell(r["time_band"]),
                sanitize_cell(r["staff_name"]),
                sanitize_cell(r["category"]),
                sanitize_cell(r["skill"]),
                sanitize_cell(r["unpaid_break"]),
                r["paid_hours"],
            ]
            if include_notes:
                row_data.append(sanitize_cell(r["notes"]))
            writer.writerow(row_data)

        writer.writerow([])
        summary_row = ["Total Scheduled Hours", "", "", "", "", "", "", round(total_paid_hours, 2)]
        if include_notes:
            summary_row.append("")
        writer.writerow(summary_row)

    # Return as utf-8-sig (with BOM)
    return output.getvalue().encode("utf-8-sig")


# ---------------------------------------------------------
# Excel (.xlsx) Export
# ---------------------------------------------------------

def generate_rota_xlsx(
    rota: Rota,
    view: Literal["staff", "day"] = "staff",
    include_notes: bool = False,
) -> bytes:
    """Generate styled Excel spreadsheet."""
    import openpyxl
    from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
    from openpyxl.utils import get_column_letter

    rows = _get_shift_data(rota, view, include_notes)
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = f"Rota {rota.start_date.strftime('%d%b')}"[:31]

    # Styles
    title_font = Font(name="Calibri", size=16, bold=True, color="0F172A")
    meta_font = Font(name="Calibri", size=10, italic=True, color="475569")
    header_font = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
    header_fill = PatternFill(start_color="1E293B", end_color="1E293B", fill_type="solid")
    summary_font = Font(name="Calibri", size=11, bold=True, color="0F172A")
    summary_fill = PatternFill(start_color="F1F5F9", end_color="F1F5F9", fill_type="solid")
    regular_font = Font(name="Calibri", size=11, color="1E293B")
    thin_border = Border(
        left=Side(style="thin", color="CBD5E1"),
        right=Side(style="thin", color="CBD5E1"),
        top=Side(style="thin", color="CBD5E1"),
        bottom=Side(style="thin", color="CBD5E1"),
    )

    # Title & Metadata
    ws["A1"] = sanitize_cell(f"Create Rota — {rota.name}")
    ws["A1"].font = title_font
    ws["A2"] = sanitize_cell(
        f"Period: {rota.start_date} to {rota.end_date} | Status: {rota.status.capitalize()} | Exported: {datetime.now(UTC).strftime('%Y-%m-%d %H:%M UTC')}"
    )
    ws["A2"].font = meta_font

    if view == "staff":
        headers = ["Staff Member", "Category", "Date", "Day", "Start Time", "End Time", "Unpaid Break (mins)", "Paid Hours", "Role / Skill"]
    else:
        headers = ["Date", "Day", "Time Band", "Staff Member", "Category", "Role / Skill", "Unpaid Break (mins)", "Paid Hours"]
    if include_notes:
        headers.append("Notes")

    start_row = 4
    for col_idx, header_text in enumerate(headers, 1):
        cell = ws.cell(row=start_row, column=col_idx, value=sanitize_cell(header_text))
        cell.font = header_font
        cell.fill = header_fill
        cell.alignment = Alignment(horizontal="center" if "Time" in header_text or "Date" in header_text else "left", vertical="center")
        cell.border = thin_border

    current_row = start_row + 1
    total_paid_hours = 0.0

    for r in rows:
        total_paid_hours += r["paid_hours"]
        if view == "staff":
            values = [
                sanitize_cell(r["staff_name"]),
                sanitize_cell(r["category"]),
                sanitize_cell(r["date"]),
                sanitize_cell(r["day"]),
                sanitize_cell(r["start_time"]),
                sanitize_cell(r["end_time"]),
                r["unpaid_break"],
                r["paid_hours"],
                sanitize_cell(r["skill"]),
            ]
        else:
            values = [
                sanitize_cell(r["date"]),
                sanitize_cell(r["day"]),
                sanitize_cell(r["time_band"]),
                sanitize_cell(r["staff_name"]),
                sanitize_cell(r["category"]),
                sanitize_cell(r["skill"]),
                r["unpaid_break"],
                r["paid_hours"],
            ]
        if include_notes:
            values.append(sanitize_cell(r["notes"]))

        for col_idx, val in enumerate(values, 1):
            cell = ws.cell(row=current_row, column=col_idx, value=val)
            cell.font = regular_font
            cell.border = thin_border
            if isinstance(val, (int, float)):
                cell.number_format = "#,##0.00" if isinstance(val, float) else "#,##0"
                cell.alignment = Alignment(horizontal="right", vertical="center")
            else:
                cell.alignment = Alignment(horizontal="left", vertical="center")

        current_row += 1

    # Summary Row
    ws.cell(row=current_row, column=1, value="Total Scheduled Hours").font = summary_font
    paid_hours_col = 8
    sum_cell = ws.cell(row=current_row, column=paid_hours_col, value=round(total_paid_hours, 2))
    sum_cell.font = summary_font
    sum_cell.number_format = "#,##0.00"

    for col_idx in range(1, len(headers) + 1):
        cell = ws.cell(row=current_row, column=col_idx)
        cell.fill = summary_fill
        cell.border = thin_border

    # Freeze panes below header
    ws.freeze_panes = "A5"

    # Auto-adjust column widths
    for col in ws.columns:
        max_len = 0
        col_letter = get_column_letter(col[0].column)
        for cell in col:
            if cell.row < 3:
                continue
            if cell.value:
                max_len = max(max_len, len(str(cell.value)))
        ws.column_dimensions[col_letter].width = max(max_len + 4, 12)

    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


# ---------------------------------------------------------
# PDF Export (ReportLab)
# ---------------------------------------------------------

def generate_rota_pdf(
    rota: Rota,
    view: Literal["staff", "day"] = "staff",
    include_notes: bool = False,
) -> bytes:
    """Generate print-ready landscape PDF with running headers and page numbers."""
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4, landscape
    from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
    from reportlab.pdfgen import canvas
    from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

    class NumberedCanvas(canvas.Canvas):
        def __init__(self, *args: Any, **kwargs: Any) -> None:
            super().__init__(*args, **kwargs)
            self._saved_page_states: list[dict[str, Any]] = []

        def showPage(self) -> None:
            self._saved_page_states.append(dict(self.__dict__))
            self._startPage()

        def save(self) -> None:
            num_pages = len(self._saved_page_states)
            for state in self._saved_page_states:
                self.__dict__.update(state)
                self.draw_page_number(num_pages)
                super().showPage()
            super().save()

        def draw_page_number(self, page_count: int) -> None:
            self.saveState()
            self.setFont("Helvetica", 9)
            self.setFillColor(colors.HexColor("#64748B"))
            page_text = f"Page {self._pageNumber} of {page_count}"
            self.drawRightString(842 - 36, 24, page_text)
            footer_text = f"Create Rota — Generated {datetime.now(UTC).strftime('%Y-%m-%d %H:%M UTC')}"
            self.drawString(36, 24, footer_text)
            self.restoreState()

    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=landscape(A4),
        leftMargin=36,
        rightMargin=36,
        topMargin=36,
        bottomMargin=45,
    )

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        "DocTitle",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=16,
        leading=20,
        textColor=colors.HexColor("#0F172A"),
    )
    meta_style = ParagraphStyle(
        "DocMeta",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=10,
        leading=14,
        textColor=colors.HexColor("#475569"),
    )
    cell_style = ParagraphStyle(
        "CellText",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=9,
        leading=11,
        textColor=colors.HexColor("#1E293B"),
    )
    cell_bold_style = ParagraphStyle(
        "CellBoldText",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=9,
        leading=11,
        textColor=colors.HexColor("#1E293B"),
    )
    header_style = ParagraphStyle(
        "HeaderCell",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=9,
        leading=11,
        textColor=colors.white,
    )

    elements: list[Any] = []
    elements.append(Paragraph(sanitize_cell(f"Create Rota — {rota.name}"), title_style))
    elements.append(
        Paragraph(
            sanitize_cell(
                f"Schedule Period: {rota.start_date} to {rota.end_date} | Status: {rota.status.capitalize()} | View: {view.capitalize()}-focused"
            ),
            meta_style,
        )
    )
    elements.append(Spacer(1, 14))

    rows = _get_shift_data(rota, view, include_notes)
    if view == "staff":
        headers = ["Staff Member", "Category", "Date", "Day", "Start", "End", "Break", "Paid Hrs", "Role / Skill"]
    else:
        headers = ["Date", "Day", "Time Band", "Staff Member", "Category", "Role / Skill", "Break", "Paid Hrs"]
    if include_notes:
        headers.append("Notes")

    table_data = [[Paragraph(h, header_style) for h in headers]]
    total_paid_hours = 0.0

    for r in rows:
        total_paid_hours += r["paid_hours"]
        if view == "staff":
            row_items = [
                Paragraph(sanitize_cell(r["staff_name"]), cell_bold_style),
                Paragraph(sanitize_cell(r["category"]), cell_style),
                Paragraph(sanitize_cell(r["date"]), cell_style),
                Paragraph(sanitize_cell(r["day"][:3]), cell_style),
                Paragraph(sanitize_cell(r["start_time"]), cell_style),
                Paragraph(sanitize_cell(r["end_time"]), cell_style),
                Paragraph(f"{r['unpaid_break']}m", cell_style),
                Paragraph(f"{r['paid_hours']:.2f}", cell_bold_style),
                Paragraph(sanitize_cell(r["skill"]), cell_style),
            ]
        else:
            row_items = [
                Paragraph(sanitize_cell(r["date"]), cell_bold_style),
                Paragraph(sanitize_cell(r["day"][:3]), cell_style),
                Paragraph(sanitize_cell(r["time_band"]), cell_style),
                Paragraph(sanitize_cell(r["staff_name"]), cell_bold_style),
                Paragraph(sanitize_cell(r["category"]), cell_style),
                Paragraph(sanitize_cell(r["skill"]), cell_style),
                Paragraph(f"{r['unpaid_break']}m", cell_style),
                Paragraph(f"{r['paid_hours']:.2f}", cell_bold_style),
            ]
        if include_notes:
            row_items.append(Paragraph(sanitize_cell(r["notes"]), cell_style))
        table_data.append(row_items)

    # Summary row
    sum_cells: list[Any] = [Paragraph("<b>Total Scheduled Hours</b>", cell_bold_style)]
    empty_count = len(headers) - 2
    sum_cells.extend([Paragraph("", cell_style) for _ in range(empty_count)])
    sum_cells.append(Paragraph(f"<b>{total_paid_hours:.2f}h</b>", cell_bold_style))
    table_data.append(sum_cells)

    t = Table(table_data, repeatRows=1)
    t.setStyle(
        TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1E293B")),
            ("ALIGN", (0, 0), (-1, -1), "LEFT"),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#E2E8F0")),
            ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#CBD5E1")),
            ("ROWBACKGROUNDS", (0, 1), (-1, -2), [colors.white, colors.HexColor("#F8FAFC")]),
            ("BACKGROUND", (0, -1), (-1, -1), colors.HexColor("#F1F5F9")),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ])
    )
    elements.append(t)

    doc.build(elements, canvasmaker=NumberedCanvas)
    return buf.getvalue()


# ---------------------------------------------------------
# Word (.docx) Export
# ---------------------------------------------------------

def generate_rota_docx(
    rota: Rota,
    view: Literal["staff", "day"] = "staff",
    include_notes: bool = False,
) -> bytes:
    """Generate clean Word document with structured rota table."""
    import docx
    from docx.shared import Inches, Pt, RGBColor

    doc = docx.Document()

    # Document margins
    sections = doc.sections
    for section in sections:
        section.top_margin = Inches(0.7)
        section.bottom_margin = Inches(0.7)
        section.left_margin = Inches(0.7)
        section.right_margin = Inches(0.7)

    # Title & Metadata
    title_p = doc.add_heading(level=1)
    title_run = title_p.add_run(sanitize_cell(f"Create Rota — {rota.name}"))
    title_run.font.name = "Calibri"
    title_run.font.size = Pt(18)
    title_run.font.color.rgb = RGBColor(15, 23, 42)

    meta_p = doc.add_paragraph()
    meta_run = meta_p.add_run(
        sanitize_cell(
            f"Schedule Period: {rota.start_date} to {rota.end_date} | Status: {rota.status.capitalize()} | Exported: {datetime.now(UTC).strftime('%Y-%m-%d %H:%M UTC')}"
        )
    )
    meta_run.font.name = "Calibri"
    meta_run.font.size = Pt(10)
    meta_run.font.italic = True
    meta_run.font.color.rgb = RGBColor(71, 85, 105)

    rows = _get_shift_data(rota, view, include_notes)
    if view == "staff":
        headers = ["Staff Member", "Category", "Date", "Day", "Start Time", "End Time", "Break (mins)", "Paid Hours", "Role / Skill"]
    else:
        headers = ["Date", "Day", "Time Band", "Staff Member", "Category", "Role / Skill", "Break (mins)", "Paid Hours"]
    if include_notes:
        headers.append("Notes")

    table = doc.add_table(rows=1, cols=len(headers))
    table.style = "Light Shading Accent 1"

    # Header Row
    hdr_cells = table.rows[0].cells
    for i, h in enumerate(headers):
        hdr_cells[i].text = sanitize_cell(h)
        for p in hdr_cells[i].paragraphs:
            for r in p.runs:
                r.font.bold = True
                r.font.size = Pt(9.5)

    total_paid_hours = 0.0
    for r in rows:
        total_paid_hours += r["paid_hours"]
        row_cells = table.add_row().cells
        if view == "staff":
            values = [
                sanitize_cell(r["staff_name"]),
                sanitize_cell(r["category"]),
                sanitize_cell(r["date"]),
                sanitize_cell(r["day"]),
                sanitize_cell(r["start_time"]),
                sanitize_cell(r["end_time"]),
                f"{r['unpaid_break']}m",
                f"{r['paid_hours']:.2f}",
                sanitize_cell(r["skill"]),
            ]
        else:
            values = [
                sanitize_cell(r["date"]),
                sanitize_cell(r["day"]),
                sanitize_cell(r["time_band"]),
                sanitize_cell(r["staff_name"]),
                sanitize_cell(r["category"]),
                sanitize_cell(r["skill"]),
                f"{r['unpaid_break']}m",
                f"{r['paid_hours']:.2f}",
            ]
        if include_notes:
            values.append(sanitize_cell(r["notes"]))

        for i, val in enumerate(values):
            row_cells[i].text = str(val)
            for p in row_cells[i].paragraphs:
                for run in p.runs:
                    run.font.size = Pt(9)

    # Summary Row
    sum_row_cells = table.add_row().cells
    sum_row_cells[0].text = "Total Scheduled Hours"
    for p in sum_row_cells[0].paragraphs:
        for run in p.runs:
            run.font.bold = True
            run.font.size = Pt(9.5)

    paid_col_idx = 7
    sum_row_cells[paid_col_idx].text = f"{total_paid_hours:.2f}h"
    for p in sum_row_cells[paid_col_idx].paragraphs:
        for run in p.runs:
            run.font.bold = True
            run.font.size = Pt(9.5)

    buf = io.BytesIO()
    doc.save(buf)
    return buf.getvalue()
