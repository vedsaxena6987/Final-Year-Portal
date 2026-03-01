// components/dashboard/admin/ManageExpertise.jsx
"use client";

import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { db } from '@/lib/firebase';
import { collection, addDoc, onSnapshot, query, orderBy, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { toast } from 'sonner';
import { Plus, Trash2, Edit, BookOpen, Tag, Users } from 'lucide-react';

export default function ManageExpertise() {
  const [expertiseTags, setExpertiseTags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editDialog, setEditDialog] = useState(false);
  const [selectedTag, setSelectedTag] = useState(null);

  // Form state
  const [tagName, setTagName] = useState("");
  const [tagDescription, setTagDescription] = useState("");
  const [tagCategory, setTagCategory] = useState("");

  const categories = [
    "Programming Languages",
    "Web Development",
    "Mobile Development", 
    "Data Science & AI/ML",
    "Database Systems",
    "Cloud Computing",
    "Cybersecurity",
    "Software Engineering",
    "Computer Networks",
    "System Administration",
    "Research Areas",
    "Other"
  ];

  useEffect(() => {
    const q = query(collection(db, "expertiseTags"), orderBy("name", "asc"));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const tagsList = querySnapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate()
      }));
      setExpertiseTags(tagsList);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleCreateTag = async (e) => {
    e.preventDefault();
    if (!tagName.trim()) {
      toast.error("Please enter a tag name.");
      return;
    }

    if (!tagCategory) {
      toast.error("Please select a category.");
      return;
    }

    try {
      // Check for duplicate names
      const existingTag = expertiseTags.find(tag => 
        tag.name.toLowerCase() === tagName.toLowerCase()
      );
      
      if (existingTag) {
        toast.error("An expertise tag with this name already exists.");
        return;
      }

      await addDoc(collection(db, "expertiseTags"), {
        name: tagName.trim(),
        description: tagDescription.trim(),
        category: tagCategory,
        createdAt: new Date(),
        isActive: true
      });

      toast.success("Expertise tag created successfully!");
      
      // Reset form
      setTagName("");
      setTagDescription("");
      setTagCategory("");
      setOpen(false);
    } catch (error) {
      toast.error("Failed to create expertise tag.", { description: error.message });
    }
  };

  const handleEditTag = async (e) => {
    e.preventDefault();
    if (!selectedTag) return;

    try {
      const tagRef = doc(db, "expertiseTags", selectedTag.id);
      await updateDoc(tagRef, {
        name: tagName.trim(),
        description: tagDescription.trim(),
        category: tagCategory,
        updatedAt: new Date()
      });

      toast.success("Expertise tag updated successfully!");
      setEditDialog(false);
      setSelectedTag(null);
      setTagName("");
      setTagDescription("");
      setTagCategory("");
    } catch (error) {
      toast.error("Failed to update expertise tag.", { description: error.message });
    }
  };

  const handleDeleteTag = async (tagId) => {
    try {
      await deleteDoc(doc(db, "expertiseTags", tagId));
      toast.success("Expertise tag deleted successfully!");
    } catch (error) {
      toast.error("Failed to delete expertise tag.", { description: error.message });
    }
  };

  const openEditDialog = (tag) => {
    setSelectedTag(tag);
    setTagName(tag.name);
    setTagDescription(tag.description || "");
    setTagCategory(tag.category);
    setEditDialog(true);
  };

  const resetForm = () => {
    setTagName("");
    setTagDescription("");
    setTagCategory("");
    setSelectedTag(null);
  };

  const groupedTags = expertiseTags.reduce((acc, tag) => {
    const category = tag.category || "Other";
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(tag);
    return acc;
  }, {});

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div className="h-8 w-48 bg-gray-200 rounded animate-pulse" />
          <div className="h-10 w-32 bg-gray-200 rounded animate-pulse" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3,4,5,6].map(i => (
            <div key={i} className="h-32 bg-gray-100 rounded animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Expertise Management</h2>
          <p className="text-muted-foreground">Manage expertise domains for faculty selection</p>
        </div>
        
        <Dialog open={open} onOpenChange={(isOpen) => {
          setOpen(isOpen);
          if (!isOpen) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Expertise Tag
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Expertise Tag</DialogTitle>
              <DialogDescription>
                Add a new expertise domain that faculty can select from.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateTag} className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="tagName">Tag Name *</Label>
                <Input
                  id="tagName"
                  placeholder="e.g., Machine Learning"
                  value={tagName}
                  onChange={(e) => setTagName(e.target.value)}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="tagCategory">Category *</Label>
                <select
                  id="tagCategory"
                  value={tagCategory}
                  onChange={(e) => setTagCategory(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  required
                >
                  <option value="">Select a category...</option>
                  {categories.map(category => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="tagDescription">Description (Optional)</Label>
                <Textarea
                  id="tagDescription"
                  placeholder="Brief description of this expertise area..."
                  value={tagDescription}
                  onChange={(e) => setTagDescription(e.target.value)}
                  rows={3}
                  className="max-h-16 md:max-h-20 resize-y"
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">Create Tag</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Tags</CardTitle>
            <Tag className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{expertiseTags.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Categories</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Object.keys(groupedTags).length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Most Popular</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-sm font-medium">Web Development</div>
            <div className="text-xs text-muted-foreground">Most selected by faculty</div>
          </CardContent>
        </Card>
      </div>

      {/* Expertise Tags by Category */}
      {Object.keys(groupedTags).length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Tag className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Expertise Tags</h3>
            <p className="text-muted-foreground mb-4 text-center max-w-sm">
              Create your first expertise tag to help students find faculty mentors.
            </p>
            <Button onClick={() => setOpen(true)}>Create First Tag</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedTags).map(([category, tags]) => (
            <Card key={category}>
              <CardHeader>
                <CardTitle className="text-lg">{category}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {tags.map((tag) => (
                    <div key={tag.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex-1">
                        <Badge variant="outline" className="mb-2">
                          {tag.name}
                        </Badge>
                        {tag.description && (
                          <p className="text-xs text-muted-foreground">
                            {tag.description}
                          </p>
                        )}
                      </div>
                      <div className="flex space-x-1 ml-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => openEditDialog(tag)}
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDeleteTag(tag.id)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={editDialog} onOpenChange={(isOpen) => {
        setEditDialog(isOpen);
        if (!isOpen) resetForm();
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Expertise Tag</DialogTitle>
            <DialogDescription>
              Update the expertise tag details.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditTag} className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="editTagName">Tag Name *</Label>
              <Input
                id="editTagName"
                value={tagName}
                onChange={(e) => setTagName(e.target.value)}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="editTagCategory">Category *</Label>
              <select
                id="editTagCategory"
                value={tagCategory}
                onChange={(e) => setTagCategory(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                required
              >
                {categories.map(category => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="editTagDescription">Description (Optional)</Label>
              <Textarea
                id="editTagDescription"
                value={tagDescription}
                onChange={(e) => setTagDescription(e.target.value)}
                rows={3}
                className="max-h-16 md:max-h-20 resize-y"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditDialog(false)}>
                Cancel
              </Button>
              <Button type="submit">Update Tag</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
