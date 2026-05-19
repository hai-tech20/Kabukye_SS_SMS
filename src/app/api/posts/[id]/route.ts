import { NextRequest, NextResponse } from 'next/server';
import { supabasePublic } from '@/lib/supabase';

// DELETE post
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    if (!id) {
      return NextResponse.json(
        { error: 'Post ID is required' },
        { status: 400 }
      );
    }

    // First, get the post to check if it has media to delete
    const { data: post, error: fetchError } = await supabasePublic
      .from('POSTS')
      .select('media_url')
      .eq('id', id)
      .single();

    if (fetchError) {
      console.error('Error fetching post:', fetchError);
      return NextResponse.json(
        { error: 'Post not found', details: fetchError.message },
        { status: 404 }
      );
    }

    // Delete the post
    const { error: deleteError } = await supabasePublic
      .from('POSTS')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('Error deleting post:', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete post', details: deleteError.message },
        { status: 500 }
      );
    }

    // If post had media, delete it from storage
    if (post?.media_url) {
      try {
        // Extract filename from URL
        const url = new URL(post.media_url);
        const pathParts = url.pathname.split('/');
        const filename = pathParts[pathParts.length - 1];
        
        if (filename) {
          await supabasePublic.storage.from('media').remove([filename]);
        }
      } catch (storageError) {
        console.error('Error deleting media file:', storageError);
        // Don't fail the request if media deletion fails
      }
    }

    return NextResponse.json(
      { message: 'Post deleted successfully' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
