#!/usr/bin/python3

import MySQLdb
import config
import argparse
import os
import errno
import re
import hashlib
import json
from PIL import Image
from PIL.ExifTags import TAGS
from PIL.ExifTags import GPSTAGS
import magic
import hashlib
import face_recognition

class ThatsVeryNAS:
    def __init__(self, config):
        self.db = MySQLdb.connect(host=config.dbhost,      # your host, usually localhost
                     user=config.dbuser,      # your username
                     passwd=config.dbpass,    # your password
                     db=config.dbname)        # name of the data base
        self.dbc = self.db.cursor()
        self.addpath_stored="INSERT INTO paths (path) VALUES (%s)"
        self.addsubpath_stored="INSERT INTO subpaths (path_id,path) VALUES (%s,%s)"
        self.getpath_stored="SELECT * FROM paths WHERE path=%s"
        self.getpaths_stored="SELECT * FROM paths WHERE status='ACTIVE'"
        self.getsubpath_stored="SELECT subpath_id,path_id,path,status FROM subpaths WHERE path_id=%s AND path=%s"
        self.getsubpaths_stored="SELECT subpath_id,path_id,path,status FROM subpaths WHERE status='ACTIVE' AND path_id=%s"
        self.addpattern_stored="INSERT INTO exclusions (pattern,subpath_id) VALUES (%s,%s)"
        self.getpattern_stored="SELECT * FROM exclusions WHERE pattern=%s AND subpath_id=%s"

#       AND IF(%s>0, f.path_id=%s, 1) '''

#        AND IF(LENGTH('%s', (MATCH (filename) AGAINST ('%s' IN NATURAL LANGUAGE MODE) 
#          OR MATCH (p.path) AGAINST ('%s' IN NATURAL LANGUAGE MODE)), 1)'''

    def IsDBInstalled(self):
        # find the main table to see if DB was set up
        self.dbc.execute("SHOW TABLES LIKE 'files'")
        if (self.dbc.rowcount > 0):
            return True
        else:
            return False

    def GetFile(self, file_hash):
        getfile_generic_stored='''SELECT p.path AS `path`,sp.path AS `subpath`,f.filename,f.modified_dt,f.status,ct.description,ct.http_header 
            FROM files f
            LEFT JOIN subpaths sp ON sp.subpath_id=f.subpath_id
            LEFT JOIN paths p ON p.path_id=sp.path_id 
            LEFT JOIN content_types ct ON ct.content_type=f.content_type
            WHERE f.file_hash=UNHEX(%s) '''
        self.dbc.execute(getfile_generic_stored, [file_hash])
        return self.dbc.fetchall()
        
    def GetFiles(self, options):
        # add a join to get image data as face_data. In PROGRESS
        getfiles_generic_stored='''SELECT p.path AS `path`,sp.path AS `subpath`,HEX(f.file_hash) AS `file_hash`,f.filename,f.modified_dt,f.status,ct.description, 
             CONCAT('[',GROUP_CONCAT(DISTINCT(fif.face_box)),']') AS `face_data`,
             image_metadata
        FROM files f
        LEFT JOIN file_image_face fif ON fif.file_hash=f.file_hash 
        LEFT JOIN file_image_metadata meta ON meta.file_hash=f.file_hash 
        LEFT JOIN subpaths sp ON sp.subpath_id=f.subpath_id
        LEFT JOIN paths p ON p.path_id=sp.path_id 
        LEFT JOIN content_types ct ON ct.content_type=f.content_type
        WHERE f.status=%s 
        GROUP BY f.file_hash'''
        params=[options["status"] if len(options["status"])>0 else "TRACKED"]

        if isinstance(options["filename"], str) and len(options["filename"])>0:
            getfiles_generic_stored = getfiles_generic_stored + " AND f.filename like CONCAT('%%', %s, '%%')"
            params.append(options["filename"])
        if isinstance(options["types"], list) and len(options["types"])>0:
            placeholders = ', '.join(['%s' for _ in options["types"]])
            getfiles_generic_stored = getfiles_generic_stored + f" AND ct.description IN ({placeholders})"
            params.extend(options["types"])
 
        self.dbc.execute(getfiles_generic_stored, params)
        result={
            "columns": [x[0] for x in self.dbc.description], #this will extract row headers
            "rows": self.dbc.fetchall()
        }
        return result

    def GetSubPathes(self, path_id):
        ret = []
        self.dbc.execute(self.getsubpaths_stored, {path_id})
        paths=self.dbc.fetchall()
        for subpath_id,path_id,path,status in paths:
            ret.append(path)
        return ret

    def GetPaths(self):
        ret = []
        self.dbc.execute(self.getpaths_stored)
        paths=self.dbc.fetchall()
        for path_id,path,status in paths:
            subpaths = self.GetSubPathes(path_id)
            ret.append({'path_id': path_id, 'path': path, 'subpaths': subpaths})
        return ret

    def PathExists(self,path):
        self.dbc.execute(self.getpath_stored, {path})
        if (self.dbc.rowcount > 0):
            row=self.dbc.fetchone()
            path_id=row[0];
            return int(path_id)
        else:
            return False

    def AddPath(self,path):
        path_id=self.PathExists(path);
        if (path_id==0):
            self.dbc.execute(self.addpath_stored, {path})
            self.db.commit()
            path_id=self.dbc.lastrowid
        return path_id;

    def SubPathExists(self,path_id,path):
        self.dbc.execute(self.getsubpath_stored, {path_id,path})
        if (self.dbc.rowcount > 0):
            row=self.dbc.fetchone()
            sub_path_id=row[0];
            return int(sub_path_id)
        else:
            return False

    def AddSubPath(self,path_id,path):
        sub_path_id=self.SubPathExists(path_id,path);
        if (sub_path_id==0):
            self.dbc.execute(self.addsubpath_stored, {path_id,path})
            self.db.commit()
            sub_path_id=self.dbc.lastrowid
        return sub_path_id;

    def ExclusionPatternExists(self,pattern,path_id):
        self.dbc.execute(self.getpattern_stored, (pattern,path_id))
        if (self.dbc.rowcount > 0):
            return True
        else:
            return False

    def AddExclusionPattern(self,pattern,path_id):
        if (self.ExclusionPatternExists(pattern,path_id) == False):
            self.dbc.execute(self.addpattern_stored, (pattern,path_id))
            self.db.commit()

    '''
    Determine content type from file
    '''
    def GetContentTypeFromFile(self,full_filename):
        fdesc = magic.from_file(full_filename)

        self.dbc.execute("""SELECT
                content_type,regex_pattern
                FROM content_types""")
        data = self.dbc.fetchall()
        for row in data :
            pattern = re.compile(row[1])
            if pattern.match(fdesc):
                return int(row[0])
            
        return 0

    '''
    Read image metadata and scan for faces. Store findings
    '''
    def AddImageData(self, file_hash, full_filename):
        image = Image.open(full_filename)
        exifdata = image._getexif()
        if exifdata:
            save_data = {}
            for tag_id, data in exifdata.items():
                # get the tag name, instead of human unreadable tag id
                tag = TAGS.get(tag_id, tag_id)
                # gotten in for loop now: data = exifdata.get(tag_id)
                # decode bytes 
                if tag == "GPSInfo" and type(data) != int:
                    gpsinfo = {}
                    print("type {}". format(type(data)))
                    for gpskey in data:
                        decode = GPSTAGS.get(gpskey,gpskey)
                        print("gpskey type {} = {}, {}". format(decode,type(data[gpskey]), str(data[gpskey])))
                        if type(data[gpskey]) == (bytes, bytearray):
                            gpsinfo[decode] = data[gpskey].decode()
                        elif type(data[gpskey]) == (bytes):
                            gpsinfo[decode] = data[gpskey].decode()
                        elif type(data[gpskey]) == (str):
                            gpsinfo[decode] = data[gpskey]
                        elif type(data[gpskey]) == (tuple):
                            gpsinfo[decode] = [x for x in data[gpskey]]
                        elif type(data[gpskey]) == (int):
                            gpsinfo[decode] = data[gpskey]
                    save_data[tag] = gpsinfo

                elif tag == "XResolution" or tag == "YResolution":
                    save_data[tag] = str(data)

                elif isinstance(data, (bytes, bytearray)):
    #                print("Tag: %s, byte: %s" %(tag,data))
                    try:
                        data = data.decode()
                        save_data[tag] = data
                    except:
                        print("Invalid data? %s: %s" %(tag,data))
                elif isinstance(data, (int)):
    #                print("Tag: %s, int: %d" %(tag,data))
                    save_data[tag] = str(data)
                elif isinstance(data, (str)):
    #                print("Tag: %s, str: %s" %(tag,data))
                    if re.fullmatch(r'[1-9][0-0][0-9][0-9]:[0-9][0-9]:[0-9][0-9] [0-9][0-9]:[0-9][0-9]:[0-9][0-9]', data):
                        # weird dataformate
                        change=list(data)
                        change[4] = '-'
                        change[7] = '-'
                        data = "".join(change)
                    save_data[tag] = data
                elif isinstance(data, (tuple)):
    #                print("Tag: %s, tuple: %s" %(tag,data))
                    save_data[tag] = [x for x in data]
                else: 
                    print("Invalid tag? %s: %s its:%s" %(tag,data,type(data)))
            print("%s" %(save_data))
            self.dbc.execute("INSERT INTO file_image_metadata SET file_hash=UNHEX('%s'), image_metadata='%s'" %(file_hash, json.dumps(save_data)))

    def AddFaces(self, file_hash, full_filename):
        print("Looking for faces %s (%s)" %(full_filename,file_hash))

        # Load the input image
        img = face_recognition.load_image_file(full_filename)

        # Detect faces in the input image
        face_locations = face_recognition.face_locations(img)

        # Encode the faces in the input image
        face_encodings = face_recognition.face_encodings(img, face_locations)

        # Store the face encodings for each face in the database
        # We store individual face data and link to the file
        i=0
        for encoding in face_encodings: 
            val = (str(encoding.tolist()),)
            self.dbc.execute("""SELECT face_id FROM people_faces
                    WHERE face_data=%s""",
                    [val])
            if (self.dbc.rowcount == 0):
                self.dbc.execute("INSERT INTO people_faces (face_data) VALUES (%s)", [val])

                # Get face ID to link to image file
                face_id=self.dbc.lastrowid

                # Get location of face
                (top, right, bottom, left) = face_locations[i]
                print("Face: ID:%d @%d, %d, %d, %d" %(face_id,top,left,bottom,right))

                print("INSERT INTO file_image_face (file_hash,face_id,face_box) VALUES (UNHEX('%s'), %d, '{\"top\":%d, \"left\":%d, \"bottom\":%d, \"right\":%d}')"
                        %(file_hash, face_id, top,left,bottom,right))
                self.dbc.execute("INSERT INTO file_image_face (file_hash,face_id,face_box) VALUES (UNHEX('%s'), %d, '{\"top\":%d, \"left\":%d, \"bottom\":%d, \"right\":%d}')" 
                        %(file_hash, face_id, top,left,bottom,right))
                self.db.commit()

            i=i+1
        
        # just testin one
        exit(0)


    def AddFile(self, subpath_id, filename, full_filename):
        BLOCKSIZE = 65536
        hasher = hashlib.sha256()
        with open(full_filename, 'rb') as afile:
            buf = afile.read(BLOCKSIZE)
            while len(buf) > 0:
                hasher.update(buf)
                buf = afile.read(BLOCKSIZE)
        file_hash = hasher.hexdigest()

        if (config.updatefilelog):
            fupdated = open(config.updatefilelog, 'a')

        print("Adding %s" %(full_filename))

        # If the filename exists but the file hash is different we need
        # to change the status on it to indicate the file exists but as a
        # different hash
        self.dbc.execute("""SELECT HEX(file_hash) FROM files
                WHERE subpath_id=%d AND filename='%s' AND file_hash!=UNHEX('%s')"""
                %(subpath_id, filename, file_hash))
        if (self.dbc.rowcount > 0):
            row=self.dbc.fetchone()
            if (fupdated):
                fupdated.write("UPDATING file: %s (%s != %s)\n" %(filename,
                    file_hash, row[0]))
            self.dbc.execute("""UPDATE files SET status='UPDATED' WHERE
                    file_hash=UNHEX('%s')""" %(row[0]))

        content_type=self.GetContentTypeFromFile(full_filename)

        # Insert the file. if the hash exists, update path and filename
        # if it moved. Add a file duplicate if they both exist
        self.dbc.execute("""SELECT HEX(file_hash) FROM files
                WHERE file_hash=UNHEX('%s')"""
                %(file_hash))
        if (self.dbc.rowcount > 0):
            self.dbc.execute("""INSERT INTO file_duplicates
                    SET file_hash=UNHEX('%s'), subpath_id=%d, filename='%s'"""
                    %(file_hash, subpath_id, filename))
        else:
            self.dbc.execute("""INSERT INTO files
                    SET file_hash=UNHEX('%s'), subpath_id=%d, filename='%s', content_type=%d
                    ON DUPLICATE KEY UPDATE subpath_id=%d, filename='%s'"""
                    %(file_hash, subpath_id, filename, content_type, subpath_id, filename))
        self.db.commit()
        if content_type in [1,2,3]:
            print("Image file: %s" %(full_filename))
            self.AddImageData(file_hash, full_filename)
            self.AddFaces(file_hash, full_filename)

    def ScanPath(self,path_id):
        print("Scanning %d" %(path_id))
        # open a log file for skipped files if configured
        if (config.skipfilelog):
            if not os.path.exists(os.path.dirname(config.skipfilelog)):
                try:
                    os.makedirs(os.path.dirname(config.skipfilelog))
                except OSError as exc: # Guard against race condition
                    if exc.errno != errno.EEXIST:
                        raise

            fskipped = open(config.skipfilelog, 'a')

        # Get given path or all paths
        if (path_id>0):
            self.dbc.execute("SELECT path_id,path FROM paths WHERE path_id=%d" %(path_id))
        else:
            self.dbc.execute("SELECT path_id,path FROM paths WHERE status='ACTIVE'")
        paths=self.dbc.fetchall()
        for path_id,path in paths:
            print("%s, %s" %(path_id, path))

            self.dbc.execute("SELECT subpath_id,path FROM subpaths WHERE status='ACTIVE' AND path_id=%d" %(path_id))
            subpaths=self.dbc.fetchall()
            for subpath_id,subpath in subpaths:
                print("%s, %s" %(subpath_id,subpath))

                # Get exclusions for the path as well as exclusions for all subpaths
                self.dbc.execute("SELECT pattern FROM exclusions WHERE subpath_id IN (0,%d)" %(subpath_id))
                patterns=self.dbc.fetchall()

                for cur_path, dirs, files in os.walk(os.path.join(path, subpath)):
                    for file in files:
                        skip=False
                        full_filename=os.path.join(path, subpath, cur_path, file)
                        rel_filename=full_filename[len(path)+len(subpath)+1:]
                        for pattern in patterns:
                            if (re.match("%s" %(pattern), "%s" %(rel_filename)) != None):
                                skip=True
                                break
                        if (skip==False):
                            self.AddFile(subpath_id, rel_filename, full_filename)
                        elif (fskipped):
                            fskipped.write("Skipping: %s\n" %full_filename)

    def PrintInfo(self):
        self.dbc.execute("""SELECT
                p.path,GROUP_CONCAT(DISTINCT e.pattern),COUNT(f.file_hash)
                FROM paths p
                LEFT JOIN exclusions e ON e.path_id=p.path_id
                LEFT JOIN files f ON f.path_id=p.path_id
                GROUP BY p.path_id""")
        data = self.dbc.fetchall()
        for row in data :
            print("%s\n%s\n%s" %(row[0], row[1], row[2]))

    def __del__(self):
        self.dbc.close()
        self.db.close()

#
# Main execution
#
if __name__ == '__main__':
    nas = ThatsVeryNAS(config)

    parser = argparse.ArgumentParser(description='Manage your nice NAS.')
    parser.add_argument('--info', '-i', action="store_true", help='Displays info on config and files')
    parser.add_argument('--addpath', '-p', help='adds a path to look for files')
    parser.add_argument('--addsubpath', '-P', help='adds a sub-path to look for files')
    parser.add_argument('--addexclusion_pattern', '-e', help='Adds a regex exlusion to ignore when scanning all paths')
    parser.add_argument('--scan', '-s', action="store_true", help='Scan path(s) and index file')

    args = parser.parse_args()

    path_id=0
    if (args.addpath):
        path_id=nas.AddPath(args.addpath)
        if (path_id>0):
            print("Path is ID: %d" %path_id)
        if (args.scan):
            nas.ScanPath(path_id)
    elif (args.addexclusion_pattern):
        nas.AddExclusionPattern(args.addexclusion,0)

    elif (args.scan):
        nas.ScanPath(path_id)

    elif (args.info):
        nas.PrintInfo()
    else:
        parser.print_help()
