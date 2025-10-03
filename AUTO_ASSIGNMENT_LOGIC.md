# Auto-Assignment Logic

## Overview
The system automatically assigns tasks to team members based on task difficulty and current workload.

---

## 📊 Assignment Rules by Difficulty

### **Easy Tasks**
- **Who can handle:** Everyone
  - ✅ Employee
  - ✅ Data Collector
  - ✅ Senior
  - ✅ Manager
  - ✅ Admin

- **Assignment strategy:** 
  - Assigns to team member with **least active tasks**
  - No role preference - purely workload-based

### **Medium Tasks**
- **Who can handle:** Employee and above
  - ✅ Employee
  - ✅ Senior
  - ✅ Manager
  - ✅ Admin
  - ❌ Data Collector (excluded)

- **Assignment strategy:**
  - Assigns to team member with **least active tasks**
  - No role preference - purely workload-based

### **Hard Tasks** 🎯
- **Who can handle:** Senior roles only
  - ✅ Senior (highest priority)
  - ✅ Manager (second priority)
  - ✅ Admin (third priority)
  - ❌ Employee (excluded)
  - ❌ Data Collector (excluded)

- **Assignment strategy:**
  - **Prefers Senior role first**
  - Then considers workload
  - If multiple seniors available, picks one with least tasks

---

## 🧮 Scoring Algorithm

For each team member, the system calculates a score (lower = better):

```
Score = Workload Ratio + Active Tasks + Estimated Hours + Role Bonus
```

### Components:

1. **Workload Ratio** (0-1)
   - `activeAssignments / 10`
   - Assumes max capacity of 10 tasks

2. **Active Tasks Count** (0.1x multiplier)
   - Direct count of active assignments
   - `activeAssignments * 0.1`

3. **Estimated Hours Impact** (0.5x multiplier)
   - `(estimatedHours / 40) * 0.5`
   - Considers task size

4. **Role Bonus** (for hard tasks only)
   - Senior: `-0.2` (highest priority)
   - Manager: `-0.15`
   - Admin: `-0.1`
   - Others: `0` (no bonus)
   - Negative values = higher priority

5. **Priority Multiplier**
   - Urgent tasks: `0.5x` multiplier (reduces score = higher priority)
   - Normal tasks: `1.0x` multiplier

---

## 📋 Examples

### Example 1: Easy Task
**Team:**
- Alice (Employee) - 2 active tasks
- Bob (Senior) - 5 active tasks
- Carol (Employee) - 1 active task

**Result:** Assigns to **Carol** (least tasks, no role preference)

---

### Example 2: Hard Task
**Team:**
- Alice (Employee) - 1 active task
- Bob (Senior) - 5 active tasks
- Carol (Senior) - 3 active tasks

**Result:** Assigns to **Carol** (Senior with fewer tasks than Bob)
- Alice is excluded (not senior role)
- Between Bob and Carol, Carol has fewer tasks

---

### Example 3: Hard Task with No Seniors
**Team:**
- Alice (Employee) - 1 active task
- Bob (Manager) - 4 active tasks
- Carol (Employee) - 2 active tasks

**Result:** Assigns to **Bob** (only Manager available)
- Employees are excluded for hard tasks
- Manager is the only eligible role

---

## 🔄 How It Works (Step by Step)

1. **Filter by Difficulty**
   - Get team members
   - Filter by eligible roles for task difficulty

2. **Count Active Tasks**
   - Query database for each member's active assignments
   - Exclude completed/delivered tasks

3. **Calculate Scores**
   - Apply scoring algorithm to each eligible member
   - Consider workload, role, priority

4. **Select Best Candidate**
   - Sort by score (ascending)
   - Pick member with lowest score

5. **Create Assignment**
   - Assign task to selected member
   - Update task status to "assigned"
   - Send notification to assigned user
   - Update user's task count

---

## 📈 Workload Tracking

The system automatically tracks workload:

- **`current_task_count`** field in users table
- Updated automatically via database triggers
- Counts only active tasks (not completed/delivered)
- Used for assignment decisions

---

## 🎯 Key Features

✅ **Workload Balancing**
- Distributes tasks evenly across team
- Prevents overloading any single member

✅ **Role-Based Assignment**
- Hard tasks only go to senior roles
- Easy/medium tasks distributed to all

✅ **Smart Prioritization**
- Urgent tasks get higher priority
- Senior roles preferred for complex work

✅ **Automatic Updates**
- Task counts sync automatically
- No manual intervention needed

---

## 🔧 Configuration

Current settings (in code):

```typescript
// Maximum task capacity assumption
const MAX_TASKS = 10;

// Role bonuses for hard tasks
const ROLE_BONUSES = {
  senior: -0.2,
  manager: -0.15,
  admin: -0.1,
  others: 0
};

// Priority multipliers
const PRIORITY_MULTIPLIERS = {
  urgent: 0.5,
  normal: 1.0
};
```

---

## 📝 Notes

- Assignment is **automatic** when task is created with a team
- Can be **manually overridden** by managers/admins
- **Reassignment** available for pending tasks
- **Notifications** sent to assigned users automatically

---

## 🚀 Usage

Auto-assignment happens automatically when:
1. Creating a new task
2. Selecting a team
3. Task has difficulty level set
4. Team has eligible members

No manual action required! 🎉
