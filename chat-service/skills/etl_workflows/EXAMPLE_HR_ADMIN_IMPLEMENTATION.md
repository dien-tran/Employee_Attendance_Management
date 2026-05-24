# Example: Phát sinh ETL cho NHÓM 1 (HR & Organization)

**Dựa trên**: `ETL_SCENARIO_GENERATION.md`

---

## Bước 1: Parse Kịch Bản

### Input Scenarios

```
NHÓM 1: NHÂN SỰ & QUẢN TRỊ CƠ CẤU (Bảng staffs & structures)
Tập trung vào tra cứu thông tin định danh và sơ đồ tổ chức.

Kịch bản 1: Tra cứu nhân viên theo phòng ban
Câu hỏi: "Liệt kê danh sách nhân viên thuộc bộ phận Kinh Doanh."
AI xử lý: Truy vấn bảng staffs, lọc theo structure_id.

Kịch bản 2: Kiểm tra trạng thái làm việc
Câu hỏi: "Có bao nhiêu nhân viên đang còn hoạt động?"
AI xử lý: Đếm số lượng bản ghi trong staffs theo trường status.

Kịch bản 3: Tìm nhân viên theo mã số
Câu hỏi: "Thông tin của nhân viên có mã DT100797?"
AI xử lý: Lọc bảng staffs theo index staffs_staff_code.
```

### Extracted Mapping

| Scenario | Source Collections | DuckDB Table | Output Path |
|----------|-------------------|--------------|-------------|
| 1 (Staff by Department) | staffs, structures | `analytics__staff_by_department` | `hr_admin/staff_by_department.md` |
| 2 (Staff Status) | staffs | `analytics__staff_status_summary` | `hr_admin/staff_status.md` |
| 3 (Staff Lookup) | staffs | `analytics__staff_lookup` | `hr_admin/staff_lookup.md` |

---

## Bước 2: Code Skeleton

### File: `stats_refactored/etl/etl_core.py`

Thêm vào class `ETL`:

```python
# ===== NHÓM 1: HR & ORGANIZATION =====

def build_staff_by_department_frames(
    self,
    staffs: pd.DataFrame,
    structures: pd.DataFrame,
) -> Dict[str, pd.DataFrame]:
    """
    Kịch bản 1: Tra cứu nhân viên theo phòng ban.
    
    Xử lý: 
    - Lấy danh sách staffs với structure_id
    - Join với structures để lấy tên phòng ban
    - Sắp xếp theo phòng ban và tên nhân viên
    
    Source: staffs, structures (MongoDB)
    Output: analytics__staff_by_department (DuckDB)
    """
    # TODO: Implement
    pass


def build_staff_status_summary_frames(
    self,
    staffs: pd.DataFrame,
) -> Dict[str, pd.DataFrame]:
    """
    Kịch bản 2: Kiểm tra trạng thái làm việc.
    
    Xử lý:
    - Đếm số nhân viên theo trường status
    - Phân loại: active (hoạt động) vs inactive
    - Tóm tắt số liệu
    
    Source: staffs (MongoDB)
    Output: analytics__staff_status_summary (DuckDB)
    """
    # TODO: Implement
    pass


def build_staff_lookup_frames(
    self,
    staffs: pd.DataFrame,
) -> Dict[str, pd.DataFrame]:
    """
    Kịch bản 3: Tìm nhân viên theo mã số.
    
    Xử lý:
    - Index: staffs_staff_code
    - Lookup bản ghi theo staff_code
    - Lấy đầy đủ thông tin nhân viên
    
    Source: staffs (MongoDB)
    Output: analytics__staff_lookup (DuckDB)
    """
    # TODO: Implement
    pass


def load_and_export_hr_admin_analytics(
    self,
    staff_by_dept: Dict[str, pd.DataFrame],
    staff_status: Dict[str, pd.DataFrame],
    staff_lookup: Dict[str, pd.DataFrame],
):
    """Load all HR admin analytics to DuckDB and export Markdown."""
    # Combine all frames
    all_frames = {**staff_by_dept, **staff_status, **staff_lookup}
    
    for table_name, df in all_frames.items():
        self.write_duckdb_table(df, table_name)
    
    self.export_hr_admin_analytics_markdown(all_frames)


def export_hr_admin_analytics_markdown(
    self,
    analytics_frames: Dict[str, pd.DataFrame],
):
    """Export HR admin analytics to category directory: hr_admin/"""
    hr_admin_dir = self.out_dir.parent / 'hr_admin'
    ensure_dir(hr_admin_dir)
    
    mapping = {
        'analytics__staff_by_department': 'staff_by_department.md',
        'analytics__staff_status_summary': 'staff_status.md',
        'analytics__staff_lookup': 'staff_lookup.md',
    }
    
    for table_name, df in analytics_frames.items():
        if table_name in mapping:
            md_filename = mapping[table_name]
            md_path = hr_admin_dir / md_filename
            self._write_collection_style_markdown(
                table_name=table_name,
                df=df,
                path=md_path,
            )
```

---

## Bước 3: Implement Transform Logic

### Scenario 1: Staff by Department

```python
def build_staff_by_department_frames(
    self,
    staffs: pd.DataFrame,
    structures: pd.DataFrame,
) -> Dict[str, pd.DataFrame]:
    """Tra cứu nhân viên theo phòng ban."""
    staffs_local = staffs.copy()
    structures_local = structures.copy()
    
    # Extract key columns from staffs
    staff_df = pd.DataFrame({
        'staff_key': self._get_col(staffs_local, '_id').astype(str),
        'staff_code': self._get_col(staffs_local, 'staff_code'),
        'full_name': self._get_col(staffs_local, 'full_name'),
        'structure_key': self._get_col(staffs_local, 'structure_id').astype(str),
        'status': self._get_col(staffs_local, 'status'),
        'job_title': self._get_col(staffs_local, 'job_title'),
        'starting_date': pd.to_datetime(
            self._get_col(staffs_local, 'starting_date'), 
            errors='coerce'
        ),
    }).drop_duplicates(subset=['staff_key'])
    
    # Extract key columns from structures
    struct_df = pd.DataFrame({
        'structure_key': self._get_col(structures_local, '_id').astype(str),
        'structure_code': self._get_col(structures_local, 'code'),
        'structure_name': self._extract_structure_name(structures_local),
    }).drop_duplicates(subset=['structure_key'])
    
    # Join: staffs + structures
    result = staff_df.merge(
        struct_df,
        on='structure_key',
        how='left',
    )
    
    # Format department label (use name or fallback to code)
    result['department'] = (
        result['structure_name']
        .fillna(result['structure_code'])
        .fillna(result['structure_key'])
    )
    
    # Sort by department, then by staff_code and full_name
    result = result.sort_values(
        ['department', 'staff_code', 'full_name'],
        na_position='last',
    )
    
    return {
        'analytics__staff_by_department': result[
            ['staff_key', 'staff_code', 'full_name', 'department', 
             'status', 'job_title', 'starting_date']
        ],
    }
```

### Scenario 2: Staff Status Summary

```python
def build_staff_status_summary_frames(
    self,
    staffs: pd.DataFrame,
) -> Dict[str, pd.DataFrame]:
    """Kiểm tra trạng thái làm việc."""
    staffs_local = staffs.copy()
    
    # Extract base info
    staff_df = pd.DataFrame({
        'staff_key': self._get_col(staffs_local, '_id').astype(str),
        'staff_code': self._get_col(staffs_local, 'staff_code'),
        'full_name': self._get_col(staffs_local, 'full_name'),
        'status': self._get_col(staffs_local, 'status'),
    }).drop_duplicates(subset=['staff_key'])
    
    # Classify: active vs inactive
    status_series = staff_df['status'].astype(str).str.lower().str.strip()
    staff_df['is_active'] = status_series.isin(['active', 'working', 'current'])
    
    # Summary by status
    status_summary = staff_df.groupby('status', dropna=False).agg(
        total_count=('staff_key', 'nunique'),
        active_count=('is_active', 'sum'),
    ).reset_index()
    
    status_summary['inactive_count'] = (
        status_summary['total_count'] - status_summary['active_count']
    )
    
    status_summary = status_summary.sort_values(
        ['total_count', 'status'],
        ascending=[False, True],
    )
    
    # Overall summary
    overall = pd.DataFrame([{
        'total_staff': int(staff_df['staff_key'].nunique()),
        'active_staff': int(staff_df['is_active'].sum()),
        'inactive_staff': int((~staff_df['is_active']).sum()),
    }])
    
    return {
        'analytics__staff_status_summary': status_summary,
        'analytics__staff_status_overall': overall,
    }
```

### Scenario 3: Staff Lookup

```python
def build_staff_lookup_frames(
    self,
    staffs: pd.DataFrame,
) -> Dict[str, pd.DataFrame]:
    """Tìm nhân viên theo mã số."""
    staffs_local = staffs.copy()
    
    # Extract full staff info
    result = pd.DataFrame({
        'staff_key': self._get_col(staffs_local, '_id').astype(str),
        'staff_code': self._get_col(staffs_local, 'staff_code'),
        'full_name': self._get_col(staffs_local, 'full_name'),
        'gender': self._get_col(staffs_local, 'gender'),
        'status': self._get_col(staffs_local, 'status'),
        'job_status': self._get_col(staffs_local, 'job_status'),
        'job_title': self._get_col(staffs_local, 'job_title'),
        'structure_id': self._get_col(staffs_local, 'structure_id'),
        'starting_date': pd.to_datetime(
            self._get_col(staffs_local, 'starting_date'),
            errors='coerce'
        ),
        'resigned_date': pd.to_datetime(
            self._get_col(staffs_local, 'resigned_date'),
            errors='coerce'
        ),
        'phone': self._get_col(staffs_local, 'phone'),
        'email': self._get_col(staffs_local, 'email'),
    }).drop_duplicates(subset=['staff_key'])
    
    # Index by staff_code for fast lookup
    result = result.set_index('staff_code').reset_index()
    result = result.sort_values('staff_code')
    
    return {
        'analytics__staff_lookup': result,
    }
```

---

## Bước 4: Cập nhật `run_etl.py`

### File: `stats_refactored/run_etl.py`

Thêm vào hàm `run_export()`:

```python
def run_export(args):
    etl = ETL(
        duckdb_path=args.duckdb,
        out_dir=args.out,
        collection_exports_dir=args.collection_exports,
    )
    mongo_db = args.mongo_db or MONGO_DB
    collections = ['staffs', 'contracts1', 'structures']

    uri = args.mongo_uri or None
    mongo_frames = etl.extract_required_mongo_collections(
        collections=collections,
        mongo_uri=uri,
        db=mongo_db,
    )
    for coll, df in mongo_frames.items():
        print(f"Loaded {coll} from MongoDB ({mongo_db}) with {len(df)} rows")

    # Export raw collections to collection_exports per MAP.md
    etl.export_collections_markdown(mongo_frames)
    print(f"Exported raw collections to: {args.collection_exports}")

    # Build and load starschema to DuckDB
    starschema_frames = etl.build_starschema_frames(
        staffs=mongo_frames['staffs'],
        contracts=mongo_frames['contracts1'],
        structures=mongo_frames['structures'],
    )
    etl.load_and_aggregate_starschema(starschema_frames)

    staff_structure_analytics = etl.build_staff_structure_analytics_frames(
        staffs=mongo_frames['staffs'],
        structures=mongo_frames['structures'],
    )
    etl.load_and_export_staff_structure_analytics(staff_structure_analytics)
    
    # Create enriched views
    staffs_contracts1 = etl.join_staffs_contracts(
        staffs=mongo_frames['staffs'],
        contracts=mongo_frames['contracts1'],
        how='left'
    )
    etl.export_enriched_views_markdown(staffs_contracts1)
    
    # ===== NEW: NHÓM 1 - HR & ORGANIZATION ANALYTICS =====
    print("\nProcessing NHÓM 1: HR & Organization Analytics...")
    
    # Kịch bản 1: Staff by Department
    staff_by_dept = etl.build_staff_by_department_frames(
        staffs=mongo_frames['staffs'],
        structures=mongo_frames['structures'],
    )
    for tbl_name, df in staff_by_dept.items():
        etl.write_duckdb_table(df, tbl_name)
        print(f"  ✓ {tbl_name}: {len(df)} rows")
    
    # Kịch bản 2: Staff Status Summary
    staff_status = etl.build_staff_status_summary_frames(
        staffs=mongo_frames['staffs'],
    )
    for tbl_name, df in staff_status.items():
        etl.write_duckdb_table(df, tbl_name)
        print(f"  ✓ {tbl_name}: {len(df)} rows")
    
    # Kịch bản 3: Staff Lookup
    staff_lookup = etl.build_staff_lookup_frames(
        staffs=mongo_frames['staffs'],
    )
    for tbl_name, df in staff_lookup.items():
        etl.write_duckdb_table(df, tbl_name)
        print(f"  ✓ {tbl_name}: {len(df)} rows")
    
    # Load and export all HR admin analytics
    all_hr_analytics = {**staff_by_dept, **staff_status, **staff_lookup}
    etl.export_hr_admin_analytics_markdown(all_hr_analytics)
    print(f"Exported HR admin analytics to: stats_refactored/hr_admin/")
    
    print("\n✓ Finished pipeline: MongoDB → collection_exports + DuckDB starschema + hr_admin analytics")
```

---

## Bước 5: Update `MAP.md`

### File: `stats_refactored/MAP.md`

Thêm vào:

```markdown
- `/hr_admin/` : HR & Organization analytics scenarios (staffs & structures focus).
  - `staff_by_department.md` : Staff directory organized by department (Scenario 1).
  - `staff_status.md` : Staff status summary (Scenario 2).
  - `staff_lookup.md` : Staff lookup by staff_code index (Scenario 3).
```

---

## Bước 6: Test & Run

### Command:

```bash
cd /Users/minhduc/Documents/Companies/EONSr/Gitlab/api-thai-duong/hr-analytics
python stats_refactored/run_etl.py
```

### Expected Output:

```
Loaded staffs from MongoDB (hr_analytics) with X rows
Loaded contracts1 from MongoDB (hr_analytics) with Y rows
Loaded structures from MongoDB (hr_analytics) with Z rows
Exported raw collections to: stats_refactored/collection_exports

Processing NHÓM 1: HR & Organization Analytics...
  ✓ analytics__staff_by_department: X rows
  ✓ analytics__staff_status_summary: N rows
  ✓ analytics__staff_status_overall: 1 rows
  ✓ analytics__staff_lookup: X rows
Exported HR admin analytics to: stats_refactored/hr_admin/

✓ Finished pipeline: MongoDB → collection_exports + DuckDB starschema + hr_admin analytics
```

### Verify Output Files:

```
stats_refactored/hr_admin/
├── staff_by_department.md
├── staff_status.md
└── staff_lookup.md
```

---

## Bước 7: Directory Structure Update

```
stats_refactored/
├── collection_exports/
│   ├── staffs.md
│   ├── contracts1.md
│   └── structures.md
├── payroll_enrichment/
│   └── staffs_contracts1.md
├── staffs_structures_analytics/
│   └── staffs_structures.md
├── hr_admin/                    # NEW
│   ├── staff_by_department.md
│   ├── staff_status.md
│   └── staff_lookup.md
├── etl/
│   ├── etl_core.py              # Updated with new methods
│   ├── mongo_reader.py
│   └── utils.py
├── output/
├── MAP.md                       # Updated
└── run_etl.py                   # Updated
```

---

## Tóm Tắt

Bằng cách tuân theo skill `ETL_SCENARIO_GENERATION.md`, ta đã:

1. ✅ Parse 3 kịch bản từ NHÓM 1
2. ✅ Tạo 3 phương thức build trong `etl_core.py`
3. ✅ Implement transform logic cho mỗi scenario
4. ✅ Thêm export markdown cho category `hr_admin/`
5. ✅ Cập nhật `run_etl.py` để gọi các phương thức mới
6. ✅ Cập nhật `MAP.md` để document cấu trúc mới
7. ✅ Ready để test pipeline

**Kết quả**: Hệ thống ETL giờ đây có khả năng phát sinh và cập nhật các kịch bản mới theo cấu trúc chuẩn!
