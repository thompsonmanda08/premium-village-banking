import React, { useState } from 'react';
import { 
  Plus, 
  LayoutGrid, 
  List, 
  MessageSquare, 
  Paperclip, 
  Calendar, 
  MoreHorizontal,
  CheckCircle2,
  Clock,
  AlertTriangle,
  FolderKanban
} from 'lucide-react';
import Card from '../ui/Card';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import Avatar from '../ui/Avatar';
import ProgressBar from '../ui/ProgressBar';
import Modal from '../ui/Modal';
import Input, { Textarea } from '../ui/Input';
import { sampleTasks } from '../../data/dashboardData';
import { ProjectTask } from '../../types';

interface ProjectsBoardViewProps {
  theme: 'dark' | 'light';
  showToast: (msg: string) => void;
}

export const ProjectsBoardView: React.FC<ProjectsBoardViewProps> = ({
  theme,
  showToast,
}) => {
  const [tasks, setTasks] = useState<ProjectTask[]>(sampleTasks);
  const [viewMode, setViewMode] = useState<'board' | 'list'>('board');
  const [isAddTaskModalOpen, setIsAddTaskModalOpen] = useState(false);

  // New task form fields
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDesc, setTaskDesc] = useState('');
  const [taskPriority, setTaskPriority] = useState<'Low' | 'Medium' | 'High' | 'Urgent'>('Medium');
  const [taskStatus, setTaskStatus] = useState<'Backlog' | 'In Progress' | 'Review' | 'Completed'>('Backlog');

  const columns: Array<'Backlog' | 'In Progress' | 'Review' | 'Completed'> = [
    'Backlog',
    'In Progress',
    'Review',
    'Completed',
  ];

  const handleCreateTask = () => {
    if (!taskTitle) {
      showToast('Please provide a task title');
      return;
    }

    const newTask: ProjectTask = {
      id: `TASK-${Math.floor(100 + Math.random() * 900)}`,
      title: taskTitle,
      description: taskDesc || 'No description provided.',
      status: taskStatus,
      priority: taskPriority,
      assignee: {
        name: 'Thompson Manda',
        initials: 'TM',
      },
      dueDate: 'Aug 30, 2026',
      commentsCount: 0,
      attachmentsCount: 0,
      progress: taskStatus === 'Completed' ? 100 : 0,
    };

    setTasks([...tasks, newTask]);
    setIsAddTaskModalOpen(false);
    setTaskTitle('');
    setTaskDesc('');
    showToast(`Task ${newTask.id} created!`);
  };

  const handleMoveTask = (taskId: string, newStatus: ProjectTask['status']) => {
    setTasks(
      tasks.map((t) =>
        t.id === taskId
          ? { ...t, status: newStatus, progress: newStatus === 'Completed' ? 100 : t.progress }
          : t
      )
    );
    showToast(`Moved task to ${newStatus}`);
  };

  const priorityColors = {
    Low: 'neutral',
    Medium: 'info',
    High: 'warning',
    Urgent: 'danger',
  } as const;

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
              Project Workflows & Task Board
            </h1>
            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
              {tasks.length} Tasks
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
            Sprint cycle roadmap, task allocation, and deliverables
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Board / List switch */}
          <div className="flex items-center p-1 bg-slate-100 dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-white/5">
            <button
              onClick={() => setViewMode('board')}
              className={`p-1.5 rounded-lg transition-all ${
                viewMode === 'board'
                  ? 'bg-white dark:bg-zinc-700 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-400 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
              }`}
              title="Kanban Board View"
            >
              <LayoutGrid size={15} />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-lg transition-all ${
                viewMode === 'list'
                  ? 'bg-white dark:bg-zinc-700 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-400 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
              }`}
              title="List Table View"
            >
              <List size={15} />
            </button>
          </div>

          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsAddTaskModalOpen(true)}
            leftIcon={<Plus size={14} />}
          >
            Create Task
          </Button>
        </div>
      </div>

      {/* Kanban Board View */}
      {viewMode === 'board' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-start">
          {columns.map((col) => {
            const colTasks = tasks.filter((t) => t.status === col);
            return (
              <div
                key={col}
                className="bg-slate-50/70 dark:bg-zinc-900/40 border border-slate-200/80 dark:border-white/5 rounded-2xl p-3.5 space-y-3 backdrop-blur-md min-h-[420px]"
              >
                {/* Column Header */}
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-indigo-500" />
                    <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                      {col}
                    </h3>
                  </div>
                  <span className="text-[11px] font-mono font-bold text-slate-400 dark:text-zinc-500 bg-slate-200 dark:bg-zinc-800 px-1.5 py-0.5 rounded-full">
                    {colTasks.length}
                  </span>
                </div>

                {/* Task Cards */}
                <div className="space-y-3">
                  {colTasks.map((task) => (
                    <div
                      key={task.id}
                      className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 rounded-xl p-3.5 shadow-sm space-y-2.5 hover:border-indigo-500/30 transition-all group"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <Badge variant={priorityColors[task.priority]} size="sm">
                          {task.priority}
                        </Badge>
                        <span className="text-[10px] font-mono text-slate-400 dark:text-zinc-500">
                          {task.id}
                        </span>
                      </div>

                      <h4 className="text-xs font-bold text-slate-800 dark:text-white leading-snug">
                        {task.title}
                      </h4>

                      <p className="text-[11px] text-slate-500 dark:text-zinc-400 line-clamp-2 leading-relaxed">
                        {task.description}
                      </p>

                      <ProgressBar value={task.progress} color="indigo" size="xs" />

                      <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-white/5 text-[11px] text-slate-400 dark:text-zinc-500">
                        <div className="flex items-center gap-1 text-[10px]">
                          <Calendar size={11} />
                          <span>{task.dueDate}</span>
                        </div>

                        <div className="flex items-center gap-2">
                          <Avatar
                            src={task.assignee.avatar}
                            name={task.assignee.name}
                            initials={task.assignee.initials}
                            size="xs"
                          />
                        </div>
                      </div>

                      {/* Quick Move Action dropdown simulator */}
                      <div className="pt-1.5 flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {columns
                          .filter((c) => c !== task.status)
                          .map((c) => (
                            <button
                              key={c}
                              onClick={() => handleMoveTask(task.id, c)}
                              className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 hover:bg-indigo-600 hover:text-white transition-colors"
                            >
                              → {c.split(' ')[0]}
                            </button>
                          ))}
                      </div>
                    </div>
                  ))}

                  {colTasks.length === 0 && (
                    <div className="py-8 text-center border border-dashed border-slate-200 dark:border-white/5 rounded-xl text-slate-400 dark:text-zinc-500 text-xs">
                      No tasks in this lane
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* List View */}
      {viewMode === 'list' && (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-zinc-900">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-zinc-950/40 text-slate-500 dark:text-zinc-400 font-semibold">
                <th className="py-3 px-4">Task ID</th>
                <th className="py-3 px-4">Title</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Priority</th>
                <th className="py-3 px-4">Assignee</th>
                <th className="py-3 px-4">Progress</th>
                <th className="py-3 px-4 text-right">Due Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
              {tasks.map((task) => (
                <tr key={task.id} className="hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors">
                  <td className="py-3 px-4 font-mono font-bold text-indigo-600 dark:text-indigo-400">{task.id}</td>
                  <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white">{task.title}</td>
                  <td className="py-3 px-4">
                    <Badge variant={task.status === 'Completed' ? 'success' : 'primary'} size="sm">
                      {task.status}
                    </Badge>
                  </td>
                  <td className="py-3 px-4">
                    <Badge variant={priorityColors[task.priority]} size="sm">
                      {task.priority}
                    </Badge>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-1.5">
                      <Avatar src={task.assignee.avatar} name={task.assignee.name} initials={task.assignee.initials} size="xs" />
                      <span className="text-slate-700 dark:text-zinc-300 font-medium">{task.assignee.name}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4 w-32">
                    <ProgressBar value={task.progress} color="indigo" size="xs" />
                  </td>
                  <td className="py-3 px-4 text-right text-slate-400 dark:text-zinc-500 font-mono">{task.dueDate}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Task Modal */}
      <Modal
        isOpen={isAddTaskModalOpen}
        onClose={() => setIsAddTaskModalOpen(false)}
        title="Create New Project Task"
        description="Assign sprint deliverables, priority level, and due deadlines."
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setIsAddTaskModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" onClick={handleCreateTask}>
              Create Task
            </Button>
          </>
        }
      >
        <div className="space-y-3.5">
          <Input
            label="Task Moniker / Title"
            placeholder="e.g. Implement Webhook Exponential Backoff"
            value={taskTitle}
            onChange={(e) => setTaskTitle(e.target.value)}
          />

          <Textarea
            label="Description & Specifications"
            placeholder="Detailed description of deliverables..."
            value={taskDesc}
            onChange={(e) => setTaskDesc(e.target.value)}
          />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 tracking-tight mb-1.5">
                Lane Status
              </label>
              <select
                value={taskStatus}
                onChange={(e) => setTaskStatus(e.target.value as any)}
                className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-zinc-900 text-slate-900 dark:text-white text-sm p-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="Backlog">Backlog</option>
                <option value="In Progress">In Progress</option>
                <option value="Review">Review</option>
                <option value="Completed">Completed</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 tracking-tight mb-1.5">
                Priority
              </label>
              <select
                value={taskPriority}
                onChange={(e) => setTaskPriority(e.target.value as any)}
                className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-zinc-900 text-slate-900 dark:text-white text-sm p-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
                <option value="Urgent">Urgent</option>
              </select>
            </div>
          </div>
        </div>
      </Modal>

    </div>
  );
};

export default ProjectsBoardView;
