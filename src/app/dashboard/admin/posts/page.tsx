'use client';

import React, { useState, useEffect } from 'react';
import AdminSidebar from '@/components/sidebar/AdminSidebar';
import { supabasePublic } from '@/lib/supabase-public';

interface Post {
  id: number;
  created_at: string;
  media_url: string | null;
  title: string;
  media_type: 'image' | 'video' | 'article' | 'announcement';
  user_id: string;
  description: string;
  youtube_url?: string;
}

interface Application {
  id: string;
  created_at: string;
  student_full_name: string;
  gender: string;
  date_of_birth: string;
  former_school: string;
  parent_guardian_full_name: string;
  parent_guardian_phone: string;
  parent_guardian_email: string;
  class_applied_for: string;
  subjects_and_grades?: Record<string, string>;
  status?: string;
}

export default function PostsManagement() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [posts, setPosts] = useState<Post[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [user, setUser] = useState<any>(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    media_type: 'image',
    media_file: null as File | null,
    youtube_url: ''
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [showApplications, setShowApplications] = useState(false);
  const [selectedApplication, setSelectedApplication] = useState<Application | null>(null);
  const [showAppModal, setShowAppModal] = useState(false);

  useEffect(() => {
    fetchPosts();
  }, []);

  const fetchPosts = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/posts');
      const data = await response.json();
      if (response.ok) {
        setPosts(data.posts || []);
      } else {
        console.error('Error fetching posts:', data.error);
        setMessage('Error fetching posts: ' + data.error);
      }
    } catch (err) {
      console.error('Error:', err);
      setMessage('Error fetching posts: ' + (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const fetchApplications = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/applications');
      const data = await response.json();
      if (response.ok) {
        setApplications(data.applications || []);
      } else {
        console.error('Error fetching applications:', data.error);
        setMessage('Error fetching applications: ' + data.error);
      }
    } catch (err) {
      console.error('Error:', err);
      setMessage('Error fetching applications: ' + (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const toggleApplicationsView = () => {
    setShowApplications(!showApplications);
    if (!showApplications) {
      fetchApplications();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    if (formData.media_type === 'image' && file) {
      if (file.size > 2 * 1024 * 1024) {
        alert('Image must be under 2MB. Please compress the image and try again.');
        e.target.value = '';
        return;
      }
    }
    setFormData({ ...formData, media_file: file });
  };

  const handleYoutubeUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, youtube_url: e.target.value });
  };

  const getYoutubeEmbedUrl = (url: string): string | null => {
    try {
      let videoId = '';
      
      if (url.includes('youtube.com/watch')) {
        const urlObj = new URL(url);
        videoId = urlObj.searchParams.get('v') || '';
      } else if (url.includes('youtu.be/')) {
        videoId = url.split('youtu.be/')[1].split('?')[0];
      } else if (url.includes('youtube.com/embed/')) {
        videoId = url.split('youtube.com/embed/')[1].split('?')[0];
      }
      
      if (!videoId) return null;
      return `https://www.youtube.com/embed/${videoId}`;
    } catch {
      return null;
    }
  };

  // Helper function to validate YouTube URL
  const isValidYoutubeUrl = (url: string): boolean => {
    if (!url) return false;
    return url.includes('youtube.com/watch') || url.includes('youtu.be/') || url.includes('youtube.com/embed/');
  };

  const ADMIN_USER_ID = '00000000-0000-0000-0000-000000000001';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      const adminUserId = ADMIN_USER_ID;
      let media_url = '';

      if (formData.media_type === 'video') {
        // Save YouTube URL directly - no upload needed
        media_url = formData.youtube_url;
      } else if (formData.media_type === 'image' && formData.media_file) {
        // Validate file size - max 2MB
        if (formData.media_file.size > 2 * 1024 * 1024) {
          throw new Error('Image must be under 2MB');
        }
        
        const fileExt = formData.media_file.name.split('.').pop();
        const fileName = `${Date.now()}.${fileExt}`;
        
        const { data: uploadData, error: uploadError } = await supabasePublic.storage
          .from('media')
          .upload(fileName, formData.media_file);

        if (uploadError) {
          throw uploadError;
        }

        const { data: { publicUrl } } = supabasePublic.storage
          .from('media')
          .getPublicUrl(fileName);

        media_url = publicUrl;
      }

      const postData = {
        title: formData.title,
        description: formData.description,
        media_type: formData.media_type,
        media_url: media_url,
        user_id: adminUserId
      };

      const response = await fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(postData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create post');
      }

      setMessage('Post created successfully!');
      setFormData({ title: '', description: '', media_type: 'image', media_file: null, youtube_url: '' });
      fetchPosts();
      setTimeout(() => setMessage(''), 3000);

    } catch (err) {
      console.error('Error creating post:', err);
      setMessage('Error creating post: ' + (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (postId: number, mediaUrl: string | null) => {
    if (!window.confirm('Are you sure you want to delete this post?')) {
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      if (mediaUrl && (mediaUrl.includes('image') || mediaUrl.includes('video'))) {
        const fileName = mediaUrl.split('/').pop();
        if (fileName) {
          await supabasePublic.storage
            .from('media')
            .remove([fileName]);
        }
      }

      const response = await fetch(`/api/posts/${postId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete post');
      }

      setMessage('Post deleted successfully!');
      fetchPosts();
      setTimeout(() => setMessage(''), 3000);

    } catch (err) {
      console.error('Error deleting post:', err);
      setMessage('Error deleting post: ' + (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteApplication = async (id: string) => {
    if (!confirm('Are you sure you want to delete this application?')) {
      return;
    }

    try {
      const response = await fetch(`/api/applications/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        fetchApplications();
        setMessage('Application deleted successfully!');
        setTimeout(() => setMessage(''), 3000);
      } else {
        const data = await response.json();
        setMessage('Error deleting application: ' + data.error);
      }
    } catch (error) {
      console.error('Error:', error);
      setMessage('Error deleting application');
    }
  };

  const handleApproveApplication = async (id: string) => {
    if (!confirm('Approve this application? This will create a student record.')) {
      return;
    }

    try {
      const response = await fetch(`/api/applications/${id}/approve`, {
        method: 'POST',
      });

      if (response.ok) {
        const data = await response.json();
        fetchApplications();
        setMessage(`Application approved! Student ID: ${data.studentId}`);
        setTimeout(() => setMessage(''), 5000);
      } else {
        const data = await response.json();
        setMessage('Error approving application: ' + data.error);
      }
    } catch (error) {
      console.error('Error:', error);
      setMessage('Error approving application');
    }
  };

  const viewApplicationDetails = (application: Application) => {
    setSelectedApplication(application);
    setShowAppModal(true);
  };

  const closeModal = () => {
    setShowAppModal(false);
    setSelectedApplication(null);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getGradeDisplay = (subjects: Record<string, string> | undefined) => {
    if (!subjects || typeof subjects !== 'object') return 'No subjects';
    
    const allSubjects: string[] = [];
    
    Object.entries(subjects).forEach(([key, value]) => {
      if (value && typeof value === 'string' && !key.startsWith('olevel_') && key !== 'subject_combination' && key !== 'optional_subject') {
        allSubjects.push(`${key}: ${value}`);
      }
    });
    
    Object.entries(subjects).forEach(([key, value]) => {
      if (key.startsWith('olevel_') && value) {
        const subject = key.replace('olevel_', '');
        allSubjects.push(`${subject}: ${value}`);
      }
    });
    
    Object.entries(subjects).forEach(([key, value]) => {
      if (typeof value === 'object' && value !== null && (value as any).subject) {
        allSubjects.push(`${(value as any).subject}: ${(value as any).grade || 'No grade'}`);
      }
    });
    
    return allSubjects.length > 0 ? allSubjects.join(', ') : 'No subjects';
  };

  const renderMedia = (post: Post) => {
    if (post.media_type === 'image' && post.media_url) {
      return <img src={post.media_url} alt={post.title} className="w-20 h-20 object-cover rounded" />;
    } else if (post.media_type === 'video' && post.media_url) {
      const embedUrl = getYoutubeEmbedUrl(post.media_url);
      if (embedUrl) {
        return (
          <div className="w-20 h-20">
            <iframe
              width="100%"
              height="100%"
              src={embedUrl}
              title={post.title}
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="rounded-lg"
            />
          </div>
        );
      } else {
        return <div className="w-20 h-20 bg-gray-200 rounded flex items-center justify-center text-xs">Invalid URL</div>;
      }
    } else {
      return <div className="w-20 h-20 bg-gradient-to-r from-green-600 to-amber-700 rounded flex items-center justify-center text-white text-xs">Doc</div>;
    }
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Sidebar - Fixed Position */}
      <AdminSidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
      {/* Main Content - Scrollable */}
      <div className={`flex-1 h-full overflow-y-auto transition-all duration-300 pt-16 lg:pt-0 ${
        sidebarOpen ? 'lg:ml-64' : 'lg:ml-20'
      }`}>
        <div className="max-w-7xl mx-auto p-8">
          {/* Header */}
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-4xl font-bold text-gray-900">
                {showApplications ? 'Student Applications' : 'Website Posts'}
              </h1>
              <p className="text-gray-600 mt-1">
                {showApplications ? 'View and manage student applications' : `Welcome, ${user?.email || 'Admin'}`}
              </p>
            </div>
            
            <div className="flex space-x-4">
              <button
                onClick={toggleApplicationsView}
                className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg transition-colors"
              >
                {showApplications ? 'Manage Posts' : 'View Applications'}
              </button>
            </div>
          </div>

          {message && (
            <div className={`p-4 rounded-lg mb-6 ${message.includes('successfully') ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
              {message}
            </div>
          )}

          {showApplications ? (
            // Applications View
            <div className="space-y-6">
              <div className="text-center mb-8">
                <h2 className="text-3xl font-bold text-gray-900 mb-2">Student Applications</h2>
                <p className="text-gray-600">View and manage all student applications</p>
              </div>

              {loading ? (
                <div className="text-center py-12">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-r-2 border-green-600"></div>
                  <p className="mt-4 text-gray-600">Loading applications...</p>
                </div>
              ) : applications.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-gray-600">No applications found.</p>
                </div>
              ) : (
                <div className="bg-white rounded-xl shadow-lg overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Student Name</th>
                        <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Class Applied</th>
                        <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Parent Contact</th>
                        <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Date Applied</th>
                        <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {applications.map((app) => (
                        <tr key={app.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4">
                            <div className="font-medium text-gray-900">{app.student_full_name}</div>
                            <div className="text-sm text-gray-500">{app.gender}</div>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-900">{app.class_applied_for}</td>
                          <td className="px-6 py-4">
                            <div className="text-sm text-gray-900">{app.parent_guardian_full_name}</div>
                            <div className="text-sm text-gray-500">{app.parent_guardian_phone}</div>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-500">{formatDate(app.created_at)}</td>
                          <td className="px-6 py-4">
                            <div className="flex gap-2">
                              <button
                                onClick={() => viewApplicationDetails(app)}
                                className="bg-blue-100 text-blue-700 px-3 py-1 rounded text-sm hover:bg-blue-200 transition-colors"
                              >
                                View
                              </button>
                              <button
                                onClick={() => handleApproveApplication(app.id)}
                                className="bg-green-100 text-green-700 px-3 py-1 rounded text-sm hover:bg-green-200 transition-colors"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => handleDeleteApplication(app.id)}
                                className="bg-red-100 text-red-700 px-3 py-1 rounded text-sm hover:bg-red-200 transition-colors"
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : (
            // Posts View
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Add New Post Form */}
              <div className="bg-white rounded-2xl shadow-lg p-8">
                <h2 className="text-2xl font-bold mb-6 text-gray-900">Add New Post</h2>
                
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Title</label>
                    <input
                      type="text"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-900 focus:border-blue-900 text-gray-900"
                      placeholder="Enter post title"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      required
                      rows={4}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-900 focus:border-blue-900 text-gray-900"
                      placeholder="Enter post description"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Media Type</label>
                    <select
                      value={formData.media_type}
                      onChange={(e) => setFormData({ ...formData, media_type: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-900 focus:border-blue-900 text-gray-900"
                    >
                      <option value="image">Image</option>
                      <option value="video">Video</option>
                      <option value="article">Article</option>
                      <option value="announcement">Announcement</option>
                    </select>
                  </div>

                  {formData.media_type === 'video' ? (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">YouTube Video URL</label>
                      <input
                        type="url"
                        placeholder="https://www.youtube.com/watch?v=..."
                        value={formData.youtube_url}
                        onChange={handleYoutubeUrlChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-900 focus:border-blue-900 text-gray-900"
                      />
                      <p className="text-sm text-gray-500 mt-1">
                        Upload your video to YouTube first, then paste the link here.
                      </p>
                      {formData.youtube_url && getYoutubeEmbedUrl(formData.youtube_url) && (
                        <div className="mt-2">
                          <iframe
                            width="100%"
                            height="200"
                            src={getYoutubeEmbedUrl(formData.youtube_url) || ''}
                            allowFullScreen
                            className="rounded-lg"
                          />
                        </div>
                      )}
                    </div>
                  ) : formData.media_type === 'image' ? (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Upload Image (max 2MB)</label>
                      <input
                        type="file"
                        onChange={handleFileChange}
                        accept="image/*"
                        required
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-900 focus:border-blue-900 text-gray-900"
                      />
                    </div>
                  ) : null}

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {loading ? 'Creating...' : 'Create Post'}
                  </button>
                </form>
              </div>

              {/* Existing Posts */}
              <div className="bg-white rounded-2xl shadow-lg p-8">
                <h2 className="text-2xl font-bold mb-6 text-gray-900">Existing Posts</h2>
                
                {posts.length === 0 ? (
                  <p className="text-gray-600 text-center py-8">No posts found.</p>
                ) : (
                  <div className="space-y-4 max-h-96 overflow-y-auto">
                    {posts.map((post) => (
                      <div key={post.id} className="border border-gray-200 rounded-lg p-4 flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          {renderMedia(post)}
                          <div>
                            <h4 className="font-semibold text-gray-900">{post.title}</h4>
                            <p className="text-sm text-gray-600">{post.media_type}</p>
                            <p className="text-xs text-gray-500">
                              {new Date(post.created_at).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        
                        <button
                          onClick={() => handleDelete(post.id, post.media_url)}
                          className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Application Details Modal */}
        {showAppModal && selectedApplication && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-bold text-gray-800">Application Details</h2>
                  <button
                    onClick={closeModal}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-gray-600">Student Name</label>
                      <p className="text-gray-900">{selectedApplication.student_full_name}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-600">Gender</label>
                      <p className="text-gray-900">{selectedApplication.gender}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-gray-600">Date of Birth</label>
                      <p className="text-gray-900">{selectedApplication.date_of_birth}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-600">Class Applied For</label>
                      <p className="text-gray-900">{selectedApplication.class_applied_for}</p>
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-600">Former School</label>
                    <p className="text-gray-900">{selectedApplication.former_school || 'N/A'}</p>
                  </div>

                  <div className="border-t pt-4">
                    <h3 className="font-semibold text-gray-900 mb-2">Parent/Guardian Information</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium text-gray-600">Name</label>
                        <p className="text-gray-900">{selectedApplication.parent_guardian_full_name}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-600">Phone</label>
                        <p className="text-gray-900">{selectedApplication.parent_guardian_phone}</p>
                      </div>
                    </div>
                    <div className="mt-2">
                      <label className="text-sm font-medium text-gray-600">Email</label>
                      <p className="text-gray-900">{selectedApplication.parent_guardian_email || 'N/A'}</p>
                    </div>
                  </div>

                  {selectedApplication.subjects_and_grades && (
                    <div className="border-t pt-4">
                      <h3 className="font-semibold text-gray-900 mb-2">Subjects & Grades</h3>
                      <p className="text-sm text-gray-700">{getGradeDisplay(selectedApplication.subjects_and_grades)}</p>
                    </div>
                  )}

                  <div className="border-t pt-4 flex gap-3">
                    <button
                      onClick={() => {
                        handleApproveApplication(selectedApplication.id);
                        closeModal();
                      }}
                      className="flex-1 bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 transition-colors"
                    >
                      Approve Application
                    </button>
                    <button
                      onClick={() => {
                        handleDeleteApplication(selectedApplication.id);
                        closeModal();
                      }}
                      className="flex-1 bg-red-600 text-white py-2 rounded-lg hover:bg-red-700 transition-colors"
                    >
                      Delete Application
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
        </div>
      </div>
  );
}
