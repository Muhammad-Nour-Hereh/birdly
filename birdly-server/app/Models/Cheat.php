<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\SoftDeletes;

class Cheat extends Model {
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'course_id',
        'title',
        'path',
    ];

    public function course() {
        return $this->belongsTo(Course::class);
    }
}
