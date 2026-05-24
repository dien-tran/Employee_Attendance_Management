# 📚 ETL Workflows Skill Suite

**Created**: May 6, 2026  
**Status**: ✅ Ready to Use

---

## 📂 Folder Structure

```
skills/etl_workflows/
├── README.md                          ← YOU ARE HERE
├── ETL_SCENARIO_GENERATION.md         ⭐ MAIN SKILL
├── EXAMPLE_HR_ADMIN_IMPLEMENTATION.md ⭐ EXAMPLE
└── QUICK_REFERENCE.md                 📋 CHEAT SHEET
```

---

## 📖 Files Overview

### 1. **ETL_SCENARIO_GENERATION.md** ⭐ PRIMARY SKILL

**Comprehensive guide** for generating ETL workflows from scenario requirements.

**Contains**:
- Input scenario format & structure
- 7-step ETL generation workflow
- Code templates & patterns
- Output organization (`category_keyword/filename.md`)
- Naming conventions (DuckDB tables, files)
- Best practices & important notes

**When to use**: Need to generate new ETL workflows  
**Read time**: ~20-30 minutes

---

### 2. **EXAMPLE_HR_ADMIN_IMPLEMENTATION.md** ⭐ REFERENCE EXAMPLE

**Step-by-step example** of applying the skill to your NHÓM 1 (HR & Organization) scenarios.

**Contains**:
- Parsing your 3 scenarios (Staff by Department, Staff Status, Staff Lookup)
- Complete code skeleton for each scenario
- Full transform logic implementation
- Integration with `run_etl.py`
- `MAP.md` updates
- Test commands & expected output

**When to use**: Implementing similar scenarios  
**Read time**: ~20-30 minutes

---

### 3. **QUICK_REFERENCE.md** 📋 CHEAT SHEET

**Quick lookup guide** with patterns and checklists.

**Contains**:
- Scenario → Code mapping diagram
- ETL generation checklist
- 5 common transform patterns (copy-paste ready)
- Directory structure reference
- File navigation guide

**When to use**: Quick reference during development  
**Read time**: ~5-10 minutes

---

## 🎯 Quick Start (3 steps)

### Step 1: Read the Overview
Start with this file (README.md) - you're already reading it! ✅

### Step 2: Understand the Main Skill
Read **`ETL_SCENARIO_GENERATION.md`** sections 1-3:
- Input format
- Workflow steps
- Process requirements

**Time**: ~15 minutes

### Step 3: Review the Example
Skim **`EXAMPLE_HR_ADMIN_IMPLEMENTATION.md`** to see practical implementation:
- How scenarios are parsed
- How code is structured
- How it's integrated

**Time**: ~10 minutes

**Total**: ~25 minutes to be ready!

---

## 🚀 How to Use This Skill

### **When you need to generate new ETL:**

```
1. User provides scenarios:
   NHÓM [N]: [Category Title]
   Kịch bản [N.M]: [Scenario details]
   
2. Agent:
   - Opens: ETL_SCENARIO_GENERATION.md
   - Parses scenarios (Section 1)
   - Follows workflow (Section 3)
   - Generates code + tests
   - Updates documentation
   
3. Result:
   ✅ New DuckDB tables
   ✅ New Markdown exports
   ✅ Updated run_etl.py
   ✅ Updated MAP.md
```

---

### **When you need to reference an example:**

```
1. Open: EXAMPLE_HR_ADMIN_IMPLEMENTATION.md

2. Find similar pattern:
   - Same source tables? → Copy pattern from Scenario X
   - Same transformation? → Reuse code from Section 3
   - Same output style? → Follow export example

3. Adapt to your needs:
   - Change table names
   - Adjust transformations
   - Update output paths
```

---

### **When you need a quick lookup:**

```
1. Open: QUICK_REFERENCE.md

2. Find what you need:
   - Code pattern? → "Thư viện Patterns" section
   - Did I miss something? → "Checklist" section
   - Need file location? → "Files to Read" section
```

---

## 📑 Navigation Guide

**Choose your path based on what you're doing:**

| I want to... | Start here | Time | Then read |
|---|---|---|---|
| **Understand the full process** | ETL_SCENARIO_GENERATION.md | 20-30 min | All sections |
| **See a working example** | EXAMPLE_HR_ADMIN_IMPLEMENTATION.md | 15-20 min | Sections 1-4 |
| **Quick lookup** | QUICK_REFERENCE.md | 5-10 min | Relevant section |
| **Copy a code pattern** | QUICK_REFERENCE.md | 2-3 min | "Thư viện Patterns" |
| **Verify my checklist** | QUICK_REFERENCE.md | 5 min | "Checklist" section |

---

## 🔑 Key Concepts

### Input: Scenario Definition
```
NHÓM [N]: [Category Title]
Kịch bản [N.M]: [Scenario Name]
- Câu hỏi: [User question]
- Xử lý: [Processing logic]
- Bảng nguồn: [MongoDB collections]
- Bảng đích: [DuckDB table]
- Output: [category_keyword/filename.md]
```

### Output: ETL Artifacts
- **DuckDB Table**: `analytics__<scenario_name>`
- **Markdown File**: `category_keyword/<filename>.md`
- **Code Method**: `build_<scenario>_frames()` in `etl_core.py`
- **Integration**: Call in `run_etl.py`
- **Documentation**: Update in `MAP.md`

### Workflow
```
Parse → Code Skeleton → Implement Logic → Integrate → Test → Document
(7-step process outlined in ETL_SCENARIO_GENERATION.md)
```

---

## 💡 Example Scenarios

### NHÓM 1: HR & Organization
- Staff by Department (staffs + structures join)
- Staff Status Summary (count & classify)
- Staff Lookup (search by staff_code)

### NHÓM 2: Payroll & Compensation (future)
- Salary Summary by Department
- Active Contracts Count
- Salary Range Analysis

### NHÓM 3: Attendance & Leaves (future)
- Attendance by Department
- Leave Balance Summary
- Turnover Rate

---

## 📊 File Structure Overview

```
skills/
├── etl_workflows/              ← You are here
│   ├── README.md
│   ├── ETL_SCENARIO_GENERATION.md
│   ├── EXAMPLE_HR_ADMIN_IMPLEMENTATION.md
│   └── QUICK_REFERENCE.md
├── stats/                      ← Other skills
│   ├── Divide.md
│   ├── Missing_Value_Handler.md
│   └── Upsert.md
└── AGENT_SKILL_GUIDANCE.md     ← Skill index (updated)
```

---

## ✨ Key Features

✅ **Structured Input Format** - Clear scenario definition template  
✅ **Step-by-Step Workflow** - 7-step process from scenarios to tested code  
✅ **Code Patterns** - Reusable templates for common ETL operations  
✅ **Proper Organization** - `category_keyword/filename.md` structure  
✅ **Full Example** - Your NHÓM 1 use case fully worked out  
✅ **Auto-Documentation** - MAP.md, run_etl.py updates included  
✅ **Quick Reference** - Cheat sheet for common tasks  

---

## 🚀 Next Steps

You can now generate ETL for any new scenario group:

1. **Prepare scenarios** (NHÓM + Kịch bản)
2. **Call Agent**: "Phát sinh ETL cho..."
3. **Agent applies skill** → Auto-generates code
4. **Agent tests** → Validates output
5. **Agent documents** → Updates MAP.md

**Each workflow takes ~10-15 minutes end-to-end!**

---

## 📞 Support

**About the skill?**  
→ Read: `ETL_SCENARIO_GENERATION.md`

**Need code examples?**  
→ Read: `EXAMPLE_HR_ADMIN_IMPLEMENTATION.md`

**Quick patterns?**  
→ Read: `QUICK_REFERENCE.md`

**Can't find what you need?**  
→ Check: `QUICK_REFERENCE.md` "Files to Read" section

---

## ✅ Ready?

You now have everything you need to generate ETL workflows!

**Start by reading**: `ETL_SCENARIO_GENERATION.md` (Section 1-2)

**Then reference**: `EXAMPLE_HR_ADMIN_IMPLEMENTATION.md` for patterns

**Happy ETL generation!** 🎉
