# Scenario -> ETL Code (No DuckDB)

## 1. Input

Input duy nhất là kịch bản. Có thể ngắn hoặc đầy đủ.

### 1.1 Format tối thiểu

```text
Kịch bản: <tên use case>
Câu hỏi tổng hợp: "<câu hỏi user>"
Nguồn dữ liệu: <list bảng/collection>
Logic xử lý: <filter/join/groupby/metric>
Output wiki: <thư mục>/<tên_file>.md
```

### 1.2 Nếu input thiếu thông tin

Agent vẫn phải sinh code và ghi rõ giả định:
- Giả định key join
- Giả định cột thời gian
- Giả định định nghĩa metric

## 2. Output

Output bắt buộc là ETL code Python, không kèm DuckDB.

### 2.1 Cấu trúc code chuẩn

```python
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
import pandas as pd


@dataclass
class ScenarioConfig:
    output_path: Path
    as_of_date: str | None = None


def extract_*() -> dict[str, pd.DataFrame]:
    """Load source datasets."""
    ...


def transform_*(frames: dict[str, pd.DataFrame]) -> pd.DataFrame:
    """Apply business aggregations for scenario."""
    ...


def to_markdown_table(df: pd.DataFrame, title: str) -> str:
    """Render deterministic markdown table."""
    ...


def publish_*(df: pd.DataFrame, config: ScenarioConfig) -> Path:
    """Write markdown wiki artifact."""
    ...


def run(config: ScenarioConfig) -> Path:
    frames = extract_*()
    result = transform_*(frames)
    return publish_*(result, config)
```

## 3. Quy tắc transform cho câu hỏi tổng hợp

1. Luôn chuẩn hóa cột thời gian trước khi group.
2. Luôn sort output ổn định (metric desc, dimension asc).
3. Luôn giới hạn output (ví dụ top N) nếu câu hỏi cần ranking.
4. Tách metric trung gian thành biến riêng để dễ debug.
5. Không mutate dataframe gốc; luôn `copy()`.

## 4. Chuẩn markdown wiki

Markdown xuất ra cần deterministic để retrieval ổn định:

1. Header metadata:
   - `scenario`
   - `generated_at`
   - `data_window`
2. Một bảng markdown chính.
3. Section `Notes` ghi giả định nghiệp vụ.

Ví dụ:

```markdown
# Headcount Growth by Department

- scenario: hr_headcount_growth
- generated_at: 2026-05-16T14:00:00Z
- data_window: 2025-11 -> 2026-04

| department | headcount_growth | growth_rate_pct |
|---|---:|---:|
| Sales | 24 | 12.5 |
| Engineering | 20 | 8.1 |

## Notes
- Active employee = status in {"active", "probation"}.
```

## 5. Template prompt để gọi skill

```text
Sinh ETL code từ kịch bản sau (không dùng DuckDB):
[dán kịch bản]

Yêu cầu:
- Output chỉ gồm code Python
- Có extract/transform/publish
- Xuất markdown wiki deterministic
- Ghi assumptions nếu thiếu thông tin
```

## 6. Checklist trước khi trả output

1. Không có bất kỳ phụ thuộc DuckDB.
2. Có đủ pipeline `extract -> transform -> publish`.
3. Có xử lý lỗi cơ bản (thiếu cột, dataset rỗng).
4. Có metadata + markdown table + notes.
5. Đặt tên hàm theo slug của scenario.

## 7. Mẫu kịch bản cá nhân (Attendance + Tenure)

Ví dụ input:

```text
Kịch bản: personal_attendance_summary
Câu hỏi tổng hợp:
- "Tháng vừa rồi tôi đi làm bao nhiêu ngày?"
- "Số ngày checkin / checkout muộn là bao nhiêu?"
- "Tôi làm ở công ty được bao lâu rồi? Đã đủ điều kiện hưởng phép chưa?"
- "Số tài khoản nhận lương của tôi là số nào?"
- "Tuần này có ngày nào tôi quên chấm công không?"
Nguồn dữ liệu: staffs, attendances
Logic xử lý:
- Dùng employee_code để xác định nhân viên
- Aggregate attendances theo attendance_date
- Tính late checkin/late checkout theo ngưỡng cấu hình
- Tính tenure từ onboard_date tới as_of_date
- Detect ngày thiếu checkin hoặc checkout trong tuần hiện tại
Output wiki: attendance_analytics/personal_attendance_summary.md
```

Assumptions gợi ý nếu business rule chưa rõ:
- Checkin muộn nếu `first_checkin > 08:30`.
- Checkout muộn nếu `last_checkout > 18:00`.
- Ngày làm việc chuẩn: Monday-Friday.
- Đủ điều kiện nghỉ phép: tenure >= 12 tháng.
