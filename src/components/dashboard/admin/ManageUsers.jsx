// components/dashboard/admin/ManageUsers.jsx
"use client";

import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { db } from '@/lib/firebase';
import { collection, onSnapshot, query, where, updateDoc, doc, writeBatch, setDoc } from 'firebase/firestore';
import { toast } from 'sonner';
import { Users, Upload, Download, UserCheck, GraduationCap, Shield, Search, Filter } from 'lucide-react';
import { useSession } from '@/context/SessionContext';

export default function ManageUsers() {
  const { activeSession } = useSession();
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [csvUploadOpen, setCsvUploadOpen] = useState(false);
  const [csvData, setCsvData] = useState("");
  const [selectedUser, setSelectedUser] = useState(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [csvFile, setCsvFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    const q = query(collection(db, "users"));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const usersList = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate()
      }));
      setUsers(usersList);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    let filtered = users;

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(user =>
        user.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Role filter
    if (roleFilter !== "all") {
      filtered = filtered.filter(user => user.role === roleFilter);
    }

    setFilteredUsers(filtered);
  }, [users, searchTerm, roleFilter]);

  const handleCsvUpload = async () => {
    if (!csvData.trim()) {
      toast.error("Please enter CSV data.");
      return;
    }

    if (!activeSession) {
      toast.error("No active session found. Please create and activate a session first.");
      return;
    }

    setUploading(true);

    try {
      // Helper function to parse CSV line properly (handles quotes)
      const parseCSVLine = (line) => {
        const result = [];
        let current = '';
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
          const char = line[i];

          if (char === '"') {
            inQuotes = !inQuotes;
          } else if (char === ',' && !inQuotes) {
            result.push(current.trim());
            current = '';
          } else {
            current += char;
          }
        }
        result.push(current.trim());
        return result.map(val => val.replace(/^["']|["']$/g, '').trim());
      };

      const lines = csvData.trim().split('\n').filter(line => line.trim());
      const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase().trim());

      // Validate headers
      const requiredHeaders = ['name', 'email', 'role'];
      const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));
      if (missingHeaders.length > 0) {
        toast.error(`Missing required headers: ${missingHeaders.join(', ')}`);
        setUploading(false);
        return;
      }

      const batch = writeBatch(db);
      let successCount = 0;
      let errors = [];
      const importedEmails = [];
      const importedUsers = []; // Track user data including role

      for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]);
        if (values.length !== headers.length) {
          errors.push(`Line ${i + 1}: Invalid number of columns`);
          continue;
        }

        const userData = {};
        headers.forEach((header, index) => {
          // Always lowercase email fields
          if (header === 'email') {
            userData[header] = values[index].toLowerCase().trim();
          } else {
            userData[header] = values[index];
          }
        });

        // Validate email domain
        const emailDomain = userData.email.split('@')[1];
        if (emailDomain !== "gehu.ac.in" && emailDomain !== "geu.ac.in") {
          errors.push(`Line ${i + 1}: Invalid email domain for ${userData.email}`);
          continue;
        }

        // Validate role
        if (!['student', 'faculty', 'admin'].includes(userData.role)) {
          errors.push(`Line ${i + 1}: Invalid role "${userData.role}" for ${userData.email}`);
          continue;
        }

        // Create user document (Auth account will be created when user first logs in/signs up)
        const userRef = doc(db, "users", userData.email);
        batch.set(userRef, {
          ...userData,
          sessionId: activeSession.id,
          createdAt: new Date(),
          importedAt: new Date(),
          isImported: true
        });

        importedEmails.push(userData.email);
        successCount++;
      }

      await batch.commit();

      if (errors.length > 0) {
        toast.warning(`Import completed with ${errors.length} errors`, {
          description: `${successCount} users imported successfully`
        });
      } else {
        toast.success(`Successfully imported ${successCount} users!`, {
          description: 'Users can now create their accounts by signing up with their email addresses.'
        });
      }

      setCsvData("");
      setCsvUploadOpen(false);
    } catch (error) {
      toast.error("Failed to import users.", { description: error.message });
    } finally {
      setUploading(false);
    }
  };

  const exportToCsv = () => {
    const csvContent = [
      "name,email,role,createdAt",
      ...filteredUsers.map(user =>
        `"${user.name || ''}","${user.email}","${user.role}","${user.createdAt?.toISOString() || ''}"`
      )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `users-export-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const getRoleIcon = (role) => {
    switch (role) {
      case 'admin': return Shield;
      case 'faculty': return UserCheck;
      case 'student': return GraduationCap;
      default: return Users;
    }
  };

  const getRoleBadgeVariant = (role) => {
    switch (role) {
      case 'admin': return 'destructive';
      case 'faculty': return 'default';
      case 'student': return 'secondary';
      default: return 'outline';
    }
  };

  const stats = {
    total: users.length,
    students: users.filter(u => u.role === 'student').length,
    faculty: users.filter(u => u.role === 'faculty').length,
    admin: users.filter(u => u.role === 'admin').length,
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-24 bg-gray-100 rounded animate-pulse" />
          ))}
        </div>
        <div className="h-96 bg-gray-100 rounded animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="card-elevated hover:scale-[1.02] transition-transform duration-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Users</CardTitle>
            <Users className="h-4 w-4 text-indigo-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-indigo-700">{stats.total}</div>
          </CardContent>
        </Card>
        <Card className="card-elevated hover:scale-[1.02] transition-transform duration-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Students</CardTitle>
            <GraduationCap className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-700">{stats.students}</div>
          </CardContent>
        </Card>
        <Card className="card-elevated hover:scale-[1.02] transition-transform duration-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Faculty</CardTitle>
            <UserCheck className="h-4 w-4 text-cyan-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-cyan-700">{stats.faculty}</div>
          </CardContent>
        </Card>
        <Card className="card-elevated hover:scale-[1.02] transition-transform duration-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Admins</CardTitle>
            <Shield className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-700">{stats.admin}</div>
          </CardContent>
        </Card>
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white/50 p-4 rounded-xl backdrop-blur-sm border border-slate-200">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center space-y-2 sm:space-y-0 sm:space-x-2 w-full sm:flex-1">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search users..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 focus-ring-brand bg-white"
            />
          </div>
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="w-full sm:w-40 bg-white">
              <Filter className="h-4 w-4 mr-2 text-slate-500" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Roles</SelectItem>
              <SelectItem value="student">Students</SelectItem>
              <SelectItem value="faculty">Faculty</SelectItem>
              <SelectItem value="admin">Admins</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex space-x-2">
          <Button variant="outline" onClick={exportToCsv}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>

          <Dialog open={csvUploadOpen} onOpenChange={setCsvUploadOpen}>
            <DialogTrigger asChild>
              <Button>
                <Upload className="h-4 w-4 mr-2" />
                Import CSV
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
              <DialogHeader className="flex-shrink-0">
                <DialogTitle>Bulk Import Users</DialogTitle>
                <DialogDescription>
                  Import multiple users at once using CSV format. Required columns: name, email, role
                  <br />
                  <span className="text-sm text-muted-foreground mt-2 block">
                    Example: John Doe, john.doe@gehu.ac.in, student
                  </span>
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 overflow-y-auto flex-1 px-1">
                <div>
                  <Label htmlFor="csvData">CSV Data</Label>
                  <Textarea
                    id="csvData"
                    placeholder="name,email,role&#10;John Doe,john.doe@gehu.ac.in,student&#10;Jane Smith,jane.smith@gehu.ac.in,faculty"
                    value={csvData}
                    onChange={(e) => setCsvData(e.target.value)}
                    rows={8}
                    className="font-mono text-sm max-h-48 md:max-h-64"
                  />
                </div>
              </div>
              <DialogFooter className="flex-shrink-0 mt-4">
                <Button variant="outline" onClick={() => setCsvUploadOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCsvUpload}>
                  Import Users
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Users Table */}
      <Card className="overflow-hidden border-none shadow-lg">
        <CardHeader className="bg-slate-50 border-b border-slate-100">
          <CardTitle className="text-lg font-semibold text-slate-800">User Directory</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Joined</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8">
                      <Users className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                      <p className="text-muted-foreground">
                        {searchTerm || roleFilter !== "all" ? "No users match your filters" : "No users found"}
                      </p>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUsers.map((user) => {
                    const RoleIcon = getRoleIcon(user.role);
                    return (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center space-x-2">
                            <RoleIcon className="h-4 w-4 text-muted-foreground" />
                            <span>{user.name || 'N/A'}</span>
                          </div>
                        </TableCell>
                        <TableCell>{user.email}</TableCell>
                        <TableCell>
                          <Badge variant={getRoleBadgeVariant(user.role)}>
                            {user.role}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {user.createdAt?.toLocaleDateString() || 'N/A'}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

    </div>
  );
}
