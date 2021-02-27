<?php
/*
This is the reference implementation of the 'placeholder list file'.  The
.list file uses ascii text to store a list of objects.  Objects are
separated with one or more blank lines.


An example of a file with 2 'project' objects and a global variable:

nextId = 14

type=project
name=timecard
id = 12
users = bob

type=project
name=timecard
id = 13
users = bob, alice, sue


*/
///////////////////////////////////////////////////////////////////////////////
final class State
{
    const IN_WHITESPACE = "WHITESPACE"; //1;
    const IN_DEFINITION= "IN_DEFINITION";//2;
    const IN_OBJECT="IN_OBJECT"; //3;
    const IN_ASSIGNMENT="IN_ASSIGNMENT";
    const IN_METADATA = "IN_METADATA";
    const COMPLETE="COMPLETE";
    const LOOKING_FOR_OBJECT="LOOKING_FOR_OBJECT";
    const UNDEFINED="UNDEFINED";
    private function __construct(){}  //prevents class from being instantianted
}

// Enumeration idea from http://us2.php.net/zend-engine-2.php
final class LineType
{
    const EOF = "EOF";
    const COMMENT="COMMENT";
    const KEY="KEY";
    const VAL="VAL";
    const KEYVAL="KEYVAL";
    const KEYDEF="KEYDEF";
    const TYPEDEF="TYPEDEF";
    const METADATA="METADATA";
    const DEFINITION="DEFINITION";
    const BLANKLINE="BLANKLINE";
    const UNDEFINED="UNDEFINED";
    private function __construct(){}  //prevents class from being instantianted
}

function file_get_objects($file,$flatten=false)
{
    if(!is_file($file)){
        error_log("Phweb:file_get_objects: $file not found.");
        return false;
    }

    if (($fp = fopen($file, "r")) == FALSE)
    {
        error("Could not open $file");
        return false;
    }
    $text = file_get_contents($file);
    $objects = parseListText($text);
    return $objects;
}

function file_put_objects($filename,$objects)
{
    $handle = fopen($filename, 'w+'); // overwrite mode
    $numOfObjects = count($objects);
    $n =0;

    foreach($objects as $object){
      //debug("GOT HERE n = $n and numOfObjects = $numOfObjects");
      foreach($object as $key => $val)
      {
          $content = $key."=".$val."\n";
          if (fwrite($handle, $content) === FALSE) {
            phdebug("Cannot write to file ($filename)");
            return false;
          }
      }
      $n++;
      // THIS MAY NOT BE NECESSARY
      if($n < $numOfObjects){ // dont write newline after last
        if (fwrite($handle,"\n") === FALSE) {
          phdebug("Cannot write to file ($filename)");
          return false;
        }
      }
    }

    fclose($handle);
    phdebug("file_put_objects: write $filename");

}


function file_put_object($filename,$object)
{
    if(file_exists($filename) == false)
    {
        phdebug("In file_put_object: file does not exist: $filename");
        return false;
    }

    $handle = fopen($filename, 'a'); // append mode

    if($handle == false)
    {
        phdebug("In file_put_object: error opening: $filename");
        return false;
    }


    foreach($object->members as $key => $val)
    {
        $content = $key."=".$val;
        if (fwrite($handle, $content) === FALSE)
        {
            phdebug("Cannot write to file ($filename)");
            exit;
        }
    }
}

function parseListText($text,$flatten=false)
{
    $linenum = 0;
    $state = State::LOOKING_FOR_OBJECT;
    $list = array();
    $curobj;
    $metadata="";
    $linetype = LineType::UNDEFINED;
    $keyindex=0;
    $keys=array();
    $lines = explode("\n",$text);

    foreach($lines as $line)
    {
        $linenum++;
        $linetype = lineType($line);

        if($state == State::IN_METADATA){
             $metadata .= $line;
        }


        if($linetype == LineType::METADATA){
          $state = State::IN_METADATA;
        }

        if($linetype == LineType::KEYDEF)
        {
          $csvkeys=lineToVal($line,':');
          $keys = explode(',',$csvkeys);
          phdebug("keys are ".makePrintArray($keys));
        }

        if($linetype == LineType::KEYVAL or $linetype == LineType::VAL)
        {
            if($state==State::LOOKING_FOR_OBJECT)  // first key/val pair
            {
                $curobj = array();
                $keyindex = 0;
                $state = State::IN_OBJECT;
            }

            if($linetype == LineType::KEYVAL){
              $key = lineToKey($line);
              $val = lineToVal($line);
            }
            else{
              $key = $keys[$keyindex];
              $val = $line;
            }

            // special syntax for values containing "="
            // a string with = signs     <-- looks like key = val
            // =a string with = signs    <-- first char = means line is a value
            if(strpos($val, "=") === 0)
                $val = substr($val,1);

            $curobj[$key] = $val;
            $keyindex++;
        }

        if($linetype == LineType::BLANKLINE and $state==State::IN_OBJECT)
        {
            $list[] = $curobj;
            $curobj['meta']=$metadata;
            $state = State::LOOKING_FOR_OBJECT;
            $curobj = null;
            $metadata = null;
        }
    }


    // last object may not end in a new line
    if($curobj !== null){
        $list[] =    $curobj;
    }

    // Go thru list and rename index to the name of the object if given.
    // Otherwise the list will be indexed by an incremental integer.

    
    foreach($list as $key=>$object)
    {
        if(array_key_exists('name',$object))
        {
            $list[$object['name']] = $object;
            unset($list[$key]);
        }
    }

    return $list;
}


function lineType($line)
{

    $type = LineType::UNDEFINED;

    // either first char is = OR there is no = in entire string
    if(strpos($line,"=") == 0 or strpos($line,"=") === false)
        $type = LineType::VAL;

    if(strncmp($line,"keys:",5)==0)
        $type = LineType::KEYDEF;

    if(strncmp($line,"fields:",5)==0)
        $type = LineType::KEYDEF;

    if(strpos($line,"=") and strpos($line,"=") !== 0)
        $type = LineType::KEYVAL;

    if(strncmp($line,"meta:",5)==0)
        $type = LineType::METADATA;

    if(strlen(trim($line))==0)
        $type = LineType::BLANKLINE;

    if(!empty($line) and $line[0]=="/")
        $type =LineType::COMMENT;

    return $type;
}

function lineToKey($line,$splitchar='=')
{
    list($itemkey,$itemval) = explode($splitchar,$line);
    return trim($itemkey);
}

function lineToVal($line,$splitchar='=')
{
    list($itemkey,$itemval) = explode($splitchar,$line);
    return trim($itemval);
}

function &createObject(&$plist,$name)
{
   if(isset($plist->object[$name]) )
      phdebug("<b>Section: $name alrady exisits.</b><br>");

    $plist->sections[$name] = new Section($name);
    return $plist->sections[$name];
}

function addParameter(&$sec,$key,$val)
{
    $sec->parameters[$key] =  $val;
}

function getParameter($plist,$secname,$key)
{
    $val = "";
    foreach ($plist->sections as $sec)
    {
       phdebug("Looking at section: $sec->name");
        if($secname == $sec->name)
        {
            $val = $sec->parameters[$key];
            break;
        }
    }
    return $val;
}

function getFirstSection($plist)
{
    $plist->cursec = 0;
    reset($plist->sections);
    return getNextSection($plist);
}

function getNextSection($plist)
{
    $plist->cursec++;
    return next($plist->sections);
}

function getSection($plist,$n)
{
    $numofsec = count($plist->sections);
    if($n >= $numofsec)
        return false;

    return $plist->$sections[$n];

}
?>
